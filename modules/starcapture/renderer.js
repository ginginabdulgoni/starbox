// ═══════════════════════════════════════════════════════════════════════════════
// Modul StarCapture — sisi renderer (halaman screenshot & rekam layar)
// Dimuat oleh core (module-host.js) setelah renderer.js. Komunikasi ke main
// process lewat window.electronAPI.modules (hanya channel di manifest.json).
// ═══════════════════════════════════════════════════════════════════════════════

const starCaptureApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    screenshotFull:   call("starcapture:screenshot-full"),
    screenshotWindow: call("starcapture:screenshot-window"),
    screenshotArea:   call("starcapture:screenshot-area"),
    getScreenSources: call("starcapture:get-screen-sources"),
    getAreaForRecord: call("starcapture:get-area-for-record"),
    copyImage:        call("starcapture:copy-image"),
    saveImage:        call("starcapture:save-image"),
    saveVideo:        call("starcapture:save-video"),
    openFile:         call("starcapture:open-file"),
    getShortcuts:     call("starcapture:get-shortcuts"),
    setShortcuts:     call("starcapture:set-shortcuts"),
    onShortcut:       (cb) => m.on("starcapture:shortcut", cb),
    onCancelled:      (cb) => m.on("starcapture:cancelled", cb),
  };
})();

// ════════════════════════════════════════════════════════════════
// STARCAPTURE – Screenshot & Screen Recording UI
// ════════════════════════════════════════════════════════════════

(function () {
  // ── State ─────────────────────────────────────────────────────
  let scCurrentDataUrl = null;  // current screenshot dataURL
  let scCurrentType    = 'screenshot'; // 'screenshot' | 'video'
  let scMediaRecorder  = null;
  let scRecChunks      = [];
  let scRecStream      = null;
  let scRecInterval    = null;
  let scRecSeconds     = 0;
  let scRecPaused      = false;
  let scAreaRect       = null;   // for area recording
  let scCropCanvas     = null;
  let scCropCtx        = null;
  let scCropVideo      = null;
  let scCropAnim       = null;

  // ── Helpers ───────────────────────────────────────────────────
  function t(k) { return window.t ? window.t(k) : k.split('.').pop(); }
  function showToastSC(msg, type) { if (typeof showToast === 'function') showToast(msg, type); }

  function scImgSize(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(`${img.naturalWidth} × ${img.naturalHeight} px`);
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }

  // ── Shortcut customization ────────────────────────────────────
  async function scLoadShortcutsUI() {
    try {
      const s = await starCaptureApi.getShortcuts();
      const inp1 = document.getElementById('scKbScreenshot');
      const inp2 = document.getElementById('scKbRecord');
      if (inp1) inp1.value = s.screenshot || '';
      if (inp2) inp2.value = s.record || '';
    } catch {}
  }

  window.scSaveShortcuts = async function () {
    const inp1 = document.getElementById('scKbScreenshot');
    const inp2 = document.getElementById('scKbRecord');
    const shortcuts = { screenshot: inp1?.value?.trim() || '', record: inp2?.value?.trim() || '' };
    try {
      const r = await starCaptureApi.setShortcuts(shortcuts);
      const status = document.getElementById('scShortcutStatus');
      if (status) { status.style.display = ''; setTimeout(() => { status.style.display = 'none'; }, 2500); }
      if (!r.ok) showToastSC('Gagal menyimpan pintasan: ' + r.error, 'error');
    } catch (e) { showToastSC('Error: ' + e.message, 'error'); }
  };

  window.scResetShortcuts = async function () {
    const inp1 = document.getElementById('scKbScreenshot');
    const inp2 = document.getElementById('scKbRecord');
    if (inp1) inp1.value = 'CommandOrControl+Shift+S';
    if (inp2) inp2.value = 'CommandOrControl+Shift+R';
    await window.scSaveShortcuts();
  };

  window.scSetShortcutFromInput = function (type) { window.scSaveShortcuts(); };

  // ── Page init ─────────────────────────────────────────────────
  window.scInitPage = function () {
    // Register shortcut listener once
    if (window._scShortcutRegistered) return;
    window._scShortcutRegistered = true;
    if (starCaptureApi.onShortcut) {
      starCaptureApi.onShortcut(mode => {
        // 'screenshot' shortcut is now handled fully in main process (overlay flow)
        // Only record shortcut still goes through renderer
        if (mode === 'record') scStartRecord('full');
      });
    }
    if (starCaptureApi.onCancelled) {
      starCaptureApi.onCancelled(() => {
        scClosePreview();
        showToastSC(t('sc.toast.cancelled'), 'info');
      });
    }
    scLoadShortcutsUI();
  };

  // Register shortcuts immediately on load (not just when page opens)
  document.addEventListener('DOMContentLoaded', () => {
    if (!window._scShortcutRegistered) window.scInitPage();
  });

  // ── Annotation System ─────────────────────────────────────────
  const scAnnotation = (() => {
    let canvas, ctx, baseImg;
    let annotations = [];
    let activeTool  = 'arrow';
    let activeColor = '#000000';
    let activeWidth = 2;
    let isDrawing   = false;
    let startX = 0, startY = 0;
    let pencilPoints = [];
    let eventsBound  = false;
    let hasImage     = false;
    let isDragText = false, dragTextIdx = -1, dragOffX = 0, dragOffY = 0;

    function coords(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    }

    function redraw(preview) {
      if (!ctx || !baseImg) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      annotations.forEach(a => drawOne(a));
      if (preview) drawOne(preview);
    }

    function drawOne(a) {
      ctx.save();
      ctx.strokeStyle = a.color; ctx.fillStyle = a.color;
      ctx.lineWidth = a.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      switch (a.type) {
        case 'arrow':   drawArrow(a); break;
        case 'rect':    drawRect(a);  break;
        case 'ellipse': drawEllipse(a); break;
        case 'pencil':  drawPencil(a);  break;
        case 'text':    drawText(a);  break;
        case 'blur':    drawBlur(a);  break;
      }
      ctx.restore();
    }

    function drawArrow({x1,y1,x2,y2,color,width}) {
      const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);
      if(len<2)return;
      const hl=Math.max(12,width*3.5), ang=Math.atan2(dy,dx);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2-hl*0.55*Math.cos(ang), y2-hl*0.55*Math.sin(ang)); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2,y2);
      ctx.lineTo(x2-hl*Math.cos(ang-Math.PI/6),y2-hl*Math.sin(ang-Math.PI/6));
      ctx.lineTo(x2-hl*Math.cos(ang+Math.PI/6),y2-hl*Math.sin(ang+Math.PI/6));
      ctx.closePath(); ctx.fill();
    }
    function drawRect({x1,y1,x2,y2}) { ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1)); }
    function drawEllipse({x1,y1,x2,y2}) {
      const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
      if(rx<1||ry<1)return;
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,2*Math.PI); ctx.stroke();
    }
    function drawPencil({points}) {
      if(!points||points.length<2)return;
      ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
      ctx.stroke();
    }
    function drawText({x,y,text,color,width}) {
      const fs=Math.max(14,width*6);
      ctx.font=`bold ${fs}px -apple-system,sans-serif`;
      ctx.fillStyle=color;
      ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=3;
      ctx.fillText(text,x,y);
      ctx.shadowBlur=0;
    }
    function drawBlur({x1,y1,x2,y2}) {
      const rx=Math.min(x1,x2),ry=Math.min(y1,y2),rw=Math.abs(x2-x1),rh=Math.abs(y2-y1);
      if(rw<4||rh<4)return;
      // Larger block = stronger pixelation blur
      const BLOCK=Math.max(20,Math.round(Math.min(rw,rh)/5));
      try {
        const imgData=ctx.getImageData(rx,ry,rw,rh), d=imgData.data;
        for(let by=0;by<rh;by+=BLOCK) for(let bx=0;bx<rw;bx+=BLOCK) {
          // Average all pixels in the block
          let tr=0,tg=0,tb=0,cnt=0;
          for(let fy=by;fy<Math.min(by+BLOCK,rh);fy++) for(let fx=bx;fx<Math.min(bx+BLOCK,rw);fx++) {
            const fi=(fy*rw+fx)*4; tr+=d[fi];tg+=d[fi+1];tb+=d[fi+2];cnt++;
          }
          const ar=tr/cnt|0,ag=tg/cnt|0,ab=tb/cnt|0;
          for(let fy=by;fy<Math.min(by+BLOCK,rh);fy++) for(let fx=bx;fx<Math.min(bx+BLOCK,rw);fx++) {
            const fi=(fy*rw+fx)*4; d[fi]=ar;d[fi+1]=ag;d[fi+2]=ab;d[fi+3]=255;
          }
        }
        ctx.putImageData(imgData,rx,ry);
      } catch(e){}
    }

    function hitTestText(ann, cx, cy) {
      if(ann.type !== 'text') return false;
      const fs = Math.max(14, ann.width * 6);
      ctx.font = `bold ${fs}px -apple-system,sans-serif`;
      const w = ctx.measureText(ann.text).width;
      return cx >= ann.x - 6 && cx <= ann.x + w + 6 && cy >= ann.y - fs - 6 && cy <= ann.y + 8;
    }

    function showTextInput(canvasX, canvasY) {
      const existing = document.getElementById('scTextInputOverlay');
      if(existing) existing.remove();
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
      const fs = Math.max(14, activeWidth * 6);
      const screenFs = Math.max(12, Math.round(fs * sy));
      const screenX = rect.left + canvasX * sx;
      const screenY = rect.top + canvasY * sy;
      const borderColor = activeColor === '#000000' || activeColor === '#000' ? 'rgba(100,100,100,0.8)' : activeColor;

      const inp = document.createElement('input');
      inp.id = 'scTextInputOverlay';
      inp.type = 'text';
      inp.placeholder = 'Ketik...';
      inp.style.cssText = `
        position:fixed;left:${screenX}px;top:${screenY - screenFs - 2}px;
        background:transparent;color:${activeColor};
        border:none;border-bottom:2px dashed ${borderColor};
        outline:none;font-size:${screenFs}px;font-weight:bold;
        font-family:-apple-system,sans-serif;padding:0 2px;
        min-width:60px;max-width:600px;z-index:99999;
        caret-color:${activeColor};
        text-shadow:${activeColor==='#000000'||activeColor==='#000'?'0 0 4px rgba(255,255,255,0.9)':'0 0 4px rgba(0,0,0,0.7)'};
      `;
      const commit = () => {
        const txt = inp.value.trim(); inp.remove();
        if(txt) { annotations.push({type:'text',x:canvasX,y:canvasY,text:txt,color:activeColor,width:activeWidth}); redraw(); }
      };
      inp.addEventListener('keydown', e => {
        if(e.key==='Enter') { e.preventDefault(); commit(); }
        if(e.key==='Escape') { e.preventDefault(); inp.remove(); }
        e.stopPropagation();
      });
      document.body.appendChild(inp);
      setTimeout(() => inp.focus(), 50);
    }

    function onDown(e) {
      if(!hasImage || e.button !== 0) return;
      const {x, y} = coords(e);
      if(activeTool === 'text') {
        isDrawing = false;
        let hit = -1;
        for(let i = annotations.length - 1; i >= 0; i--) { if(hitTestText(annotations[i], x, y)) { hit = i; break; } }
        if(hit >= 0) {
          isDragText = true; dragTextIdx = hit;
          dragOffX = x - annotations[hit].x; dragOffY = y - annotations[hit].y;
        } else {
          showTextInput(x, y);
        }
        return;
      }
      isDrawing = true; startX = x; startY = y;
      if(activeTool === 'pencil') pencilPoints = [{x, y}];
    }
    function onMove(e) {
      const {x, y} = coords(e);
      if(activeTool === 'text') {
        if(isDragText && dragTextIdx >= 0) {
          annotations[dragTextIdx].x = x - dragOffX;
          annotations[dragTextIdx].y = y - dragOffY;
          redraw();
        } else {
          canvas.style.cursor = annotations.some(a => hitTestText(a, x, y)) ? 'move' : 'text';
        }
        return;
      }
      if(!isDrawing) return;
      if(activeTool === 'pencil') { pencilPoints.push({x,y}); redraw({type:'pencil',points:[...pencilPoints],color:activeColor,width:activeWidth}); }
      else { redraw({type:activeTool,x1:startX,y1:startY,x2:x,y2:y,color:activeColor,width:activeWidth}); }
    }
    function onUp(e) {
      if(isDragText) { isDragText = false; dragTextIdx = -1; redraw(); return; }
      if(!isDrawing) return; isDrawing = false;
      const {x, y} = coords(e);
      if(activeTool === 'pencil') {
        if(pencilPoints.length > 1) annotations.push({type:'pencil',points:[...pencilPoints],color:activeColor,width:activeWidth});
      } else if(activeTool !== 'text') {
        if(Math.abs(x-startX) > 2 || Math.abs(y-startY) > 2) annotations.push({type:activeTool,x1:startX,y1:startY,x2:x,y2:y,color:activeColor,width:activeWidth});
      }
      pencilPoints = []; redraw();
    }

    function bindEvents() {
      if(eventsBound)return; eventsBound=true;
      canvas.addEventListener('mousedown',onDown);
      canvas.addEventListener('mousemove',onMove);
      canvas.addEventListener('mouseup',onUp);
      canvas.addEventListener('mouseleave',onUp);
    }

    return {
      init(dataUrl) {
        canvas=document.getElementById('scAnnotateCanvas');
        if(!canvas)return;
        ctx=canvas.getContext('2d');
        annotations=[]; hasImage=false;
        bindEvents();
        const img=new Image();
        img.onload=()=>{
          canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
          baseImg=img; hasImage=true;
          redraw();
          canvas.style.display='block';
          const tb=document.getElementById('scAnnotateToolbar');
          if(tb) tb.classList.add('visible');
        };
        img.src=dataUrl;
      },
      setTool(tool) {
        activeTool=tool;
        document.querySelectorAll('.sc-annot-tool').forEach(b=>b.classList.remove('active'));
        const id='scTool'+tool.charAt(0).toUpperCase()+tool.slice(1);
        const btn=document.getElementById(id); if(btn) btn.classList.add('active');
        if(canvas) canvas.style.cursor=tool==='text'?'text':tool==='blur'?'cell':'crosshair';
      },
      setColor(color) {
        activeColor=color;
        const dot=document.getElementById('scAnnotColorDot'); if(dot) dot.style.background=color;
      },
      setWidth(w, btn) {
        activeWidth=w;
        document.querySelectorAll('.sc-annot-sz').forEach(b=>b.classList.remove('active'));
        if(btn) btn.classList.add('active');
      },
      undo() { annotations.pop(); redraw(); },
      clear() { annotations=[]; redraw(); },
      getDataUrl() { return canvas&&hasImage?canvas.toDataURL('image/png'):null; },
      reset() {
        hasImage=false; annotations=[];
        if(canvas){ canvas.style.display='none'; canvas.width=0; canvas.height=0; }
        const tb=document.getElementById('scAnnotateToolbar'); if(tb) tb.classList.remove('visible');
      },
    };
  })();
  window.scAnnotation = scAnnotation;

  // ── Screenshot ────────────────────────────────────────────────
  window.scTakeScreenshot = async function (mode) {
    // For area mode: don't show loading — main window is minimized during overlay
    if (mode !== 'area') scShowPreviewLoading(t('sc.preview.title'));
    try {
      let dataUrl = null;
      if (mode === 'full') {
        dataUrl = await starCaptureApi.screenshotFull();
      } else if (mode === 'area') {
        dataUrl = await starCaptureApi.screenshotArea();
      } else if (mode === 'window') {
        dataUrl = await starCaptureApi.screenshotWindow();
      }
      if (!dataUrl) { scClosePreview(); return; }
      await scShowScreenshotPreview(dataUrl);
    } catch (e) {
      scClosePreview();
      showToastSC(t('sc.toast.capture_error'), 'error');
    }
  };

  async function scShowScreenshotPreview(dataUrl) {
    scCurrentDataUrl = dataUrl;
    scCurrentType    = 'screenshot';
    const size = await scImgSize(dataUrl);
    const vid     = document.getElementById('scPreviewVideo');
    const loading = document.getElementById('scPreviewLoading');
    const meta    = document.getElementById('scPreviewMeta');
    const icon    = document.getElementById('scPreviewIcon');
    const title   = document.getElementById('scPreviewTitle');
    const btnCopy = document.getElementById('scBtnCopy');
    const btnBoth = document.getElementById('scBtnBoth');

    if (vid)     vid.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (meta)    meta.textContent = size;
    if (icon)    { icon.className = 'bi bi-image'; icon.style.color = '#7c6fe0'; }
    if (title)   title.textContent = t('sc.preview.title');
    if (btnCopy) btnCopy.style.display = '';
    if (btnBoth) btnBoth.style.display = '';

    scAnnotation.init(dataUrl);

    const overlay = document.getElementById('scPreviewOverlay');
    if (overlay) overlay.classList.add('open');
  }

  // ── Copy / Save ───────────────────────────────────────────────
  function scGetCurrentDataUrl() {
    if (scCurrentType === 'screenshot') return scAnnotation.getDataUrl() || scCurrentDataUrl;
    return scCurrentDataUrl;
  }

  window.scCopyToClipboard = async function () {
    const dataUrl = scGetCurrentDataUrl();
    if (!dataUrl) return;
    try {
      const result = await starCaptureApi.copyImage(dataUrl);
      if (result.ok) showToastSC(t('sc.toast.copied'), 'success');
      else showToastSC(t('sc.toast.copy_error'), 'error');
    } catch { showToastSC(t('sc.toast.copy_error'), 'error'); }
  };

  window.scSaveFile = async function () {
    if (scCurrentType === 'screenshot') {
      await scSaveScreenshot();
    } else {
      await scSaveVideoFile();
    }
  };

  window.scSaveBoth = async function () {
    await scCopyToClipboard();
    await scSaveFile();
  };

  async function scSaveScreenshot() {
    const dataUrl = scGetCurrentDataUrl();
    if (!dataUrl) return;
    try {
      const result = await starCaptureApi.saveImage({
        dataUrl,
        defaultName: `screenshot-${Date.now()}.png`,
      });
      if (result.ok) {
        showToastSC(t('sc.toast.saved') + (result.filePath ? ': ' + result.filePath.split(/[\\/]/).pop() : ''), 'success');
        scClosePreview();
      }
    } catch { showToastSC(t('sc.toast.save_error'), 'error'); }
  }

  async function scSaveVideoFile() {
    if (!scRecChunks.length) return;
    try {
      const blob = new Blob(scRecChunks, { type: 'video/webm' });
      const buffer = await blob.arrayBuffer();
      const result = await starCaptureApi.saveVideo({
        buffer: new Uint8Array(buffer),
        format: 'webm',
        defaultName: `recording-${Date.now()}.webm`,
      });
      if (result.ok) {
        showToastSC(t('sc.toast.video_saved') + (result.filePath ? ': ' + result.filePath.split(/[\\/]/).pop() : ''), 'success');
        scClosePreview();
      }
    } catch (e) { showToastSC(t('sc.toast.save_error'), 'error'); }
  }

  // ── Preview helpers ───────────────────────────────────────────
  function scShowPreviewLoading(title) {
    const overlay  = document.getElementById('scPreviewOverlay');
    const loading  = document.getElementById('scPreviewLoading');
    const canvas   = document.getElementById('scAnnotateCanvas');
    const vid      = document.getElementById('scPreviewVideo');
    const titleEl  = document.getElementById('scPreviewTitle');
    if (loading) loading.style.display = '';
    if (canvas) canvas.style.display = 'none';
    if (vid)    vid.style.display = 'none';
    if (titleEl && title) titleEl.textContent = title;
    if (overlay) overlay.classList.add('open');
  }

  window.scClosePreview = function () {
    const overlay = document.getElementById('scPreviewOverlay');
    if (overlay) overlay.classList.remove('open');
    const vid = document.getElementById('scPreviewVideo');
    if (vid) { vid.src = ''; vid.style.display = 'none'; }
    scAnnotation.reset();
    scCurrentDataUrl = null;
  };

  // Escape to close preview
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('scPreviewOverlay');
      if (overlay?.classList.contains('open')) { scClosePreview(); e.stopPropagation(); }
    }
  });

  // ── Screen Recording ──────────────────────────────────────────
  window.scStartRecord = async function (mode) {
    if (scMediaRecorder && scMediaRecorder.state !== 'inactive') return;
    scRecChunks = [];
    scAreaRect  = null;

    try {
      let sourceId, constraints;

      if (mode === 'area') {
        const rect = await starCaptureApi.getAreaForRecord();
        if (!rect) return;
        scAreaRect = rect;
      }

      // Get screen source
      const sources = await starCaptureApi.getScreenSources();
      if (!sources || !sources.length) { showToastSC(t('sc.toast.no_source'), 'error'); return; }
      sourceId = sources[0].id;

      // getUserMedia stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1, maxWidth: 7680,
            minHeight: 1, maxHeight: 4320,
          }
        }
      });

      let recordStream = stream;

      // If area mode — crop via canvas
      if (scAreaRect) {
        const { displayX: x, displayY: y, displayW: w, displayH: h } = scAreaRect;
        scCropVideo = document.createElement('video');
        scCropVideo.srcObject = stream;
        scCropVideo.muted = true;
        await scCropVideo.play();

        scCropCanvas = document.createElement('canvas');
        scCropCanvas.width  = w;
        scCropCanvas.height = h;
        scCropCtx = scCropCanvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        function drawFrame() {
          if (!scCropCtx || !scCropVideo) return;
          scCropCtx.drawImage(scCropVideo, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w, h);
          scCropAnim = requestAnimationFrame(drawFrame);
        }
        drawFrame();
        recordStream = scCropCanvas.captureStream(30);
      }

      scRecStream = stream;
      scMediaRecorder = new MediaRecorder(recordStream, { mimeType: 'video/webm;codecs=vp8' });
      scMediaRecorder.ondataavailable = e => { if (e.data.size > 0) scRecChunks.push(e.data); };
      scMediaRecorder.onstop = scOnRecordStop;
      scMediaRecorder.start(500);

      scRecSeconds = 0;
      scRecPaused  = false;
      scRecInterval = setInterval(() => {
        if (!scRecPaused) {
          scRecSeconds++;
          const m = String(Math.floor(scRecSeconds / 60)).padStart(2, '0');
          const s = String(scRecSeconds % 60).padStart(2, '0');
          const timeEl = document.getElementById('scRecordTime');
          if (timeEl) timeEl.textContent = `${m}:${s}`;
        }
      }, 1000);

      const bar = document.getElementById('scRecordBar');
      if (bar) bar.classList.add('open');

      showToastSC(t('sc.toast.recording_started'), 'success');
    } catch (e) {
      console.error('StarCapture recording error:', e);
      showToastSC(t('sc.toast.record_error') + ': ' + (e.message || e), 'error');
    }
  };

  window.scPauseRecord = function () {
    if (!scMediaRecorder) return;
    const btn = document.getElementById('scBtnPause');
    if (scRecPaused) {
      scMediaRecorder.resume();
      scRecPaused = false;
      if (btn) btn.textContent = t('sc.rec.pause');
    } else {
      scMediaRecorder.pause();
      scRecPaused = true;
      if (btn) btn.textContent = t('sc.rec.resume');
    }
  };

  window.scStopRecord = function () {
    if (!scMediaRecorder) return;
    clearInterval(scRecInterval);
    scMediaRecorder.stop();
    const bar = document.getElementById('scRecordBar');
    if (bar) bar.classList.remove('open');
  };

  async function scOnRecordStop() {
    // Clean up area crop animation
    if (scCropAnim) { cancelAnimationFrame(scCropAnim); scCropAnim = null; }
    if (scCropVideo) { scCropVideo.pause(); scCropVideo.srcObject = null; scCropVideo = null; }
    scCropCanvas = null; scCropCtx = null;
    // Stop original stream
    if (scRecStream) { scRecStream.getTracks().forEach(t => t.stop()); scRecStream = null; }

    if (!scRecChunks.length) return;
    scCurrentType = 'video';
    scCurrentDataUrl = null;

    const blob = new Blob(scRecChunks, { type: 'video/webm' });
    const url  = URL.createObjectURL(blob);

    const vid     = document.getElementById('scPreviewVideo');
    const canvas  = document.getElementById('scAnnotateCanvas');
    const loading = document.getElementById('scPreviewLoading');
    const meta    = document.getElementById('scPreviewMeta');
    const icon    = document.getElementById('scPreviewIcon');
    const title   = document.getElementById('scPreviewTitle');
    const btnCopy = document.getElementById('scBtnCopy');
    const btnBoth = document.getElementById('scBtnBoth');

    if (vid)    { vid.src = url; vid.style.display = 'block'; }
    if (canvas) canvas.style.display = 'none';
    if (loading) loading.style.display = 'none';
    const dur = `${String(Math.floor(scRecSeconds/60)).padStart(2,'0')}:${String(scRecSeconds%60).padStart(2,'0')}`;
    if (meta) meta.textContent = `WebM · ${dur}`;
    if (icon) { icon.className = 'bi bi-camera-video'; icon.style.color = '#ef4444'; }
    if (title) title.textContent = t('sc.rec.preview_title');
    if (btnCopy) btnCopy.style.display = 'none';
    if (btnBoth) btnBoth.style.display = 'none';

    const overlay = document.getElementById('scPreviewOverlay');
    if (overlay) overlay.classList.add('open');

    showToastSC(t('sc.toast.recording_done'), 'success');
  }
})();
