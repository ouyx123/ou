'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const byId = new Map(window.VSR_RECORDS.map(record => [record.id, record]));
  const source = $('sourceVideo');
  const roi = $('roiVideo');
  let selected = null;
  let objectUrl = null;
  let controller = null;
  let ready = false;
  let complete = false;
  let roiActive = false;
  let firstPass = false;
  let sync = true;
  let toastTimer;

  // Normalize the basename, not upload order. Also accept Windows duplicate suffixes.
  function videoId(name) {
    return String(name).split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
      .replace(/(?:\s*[（(]\d+[)）])+\s*$/, '').trim().toLowerCase();
  }
  const formatTime = seconds => Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` : '—';
  const videoStatus = (element, text, tone = 'neutral') => {
    element.replaceChildren();
    const dot = document.createElement('span');
    dot.className = `status-dot ${tone}`;
    element.append(dot, document.createTextNode(text));
  };
  function message(text = '') {
    $('errorMessage').textContent = text;
    $('errorMessage').hidden = !text;
  }
  function notify(text) {
    clearTimeout(toastTimer);
    $('toast').querySelector('span').textContent = text;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000);
  }
  function description(text) { $('actionDescription').querySelector('span').textContent = text; }
  function setStep(index, finished = false) {
    [1, 2, 3].forEach(i => {
      const element = $(`step${i}`);
      element.className = `step${i < index || finished ? ' done' : ''}${i === index && !finished ? ' active' : ''}`;
      if (i === index && !finished) element.setAttribute('aria-current', 'step');
      else element.removeAttribute('aria-current');
    });
  }
  function controls() {
    $('recognizeButton').disabled = !selected || !ready || !!controller;
    $('resetButton').disabled = source.hidden;
    $('copyButton').disabled = !complete;
    $('downloadButton').disabled = !complete;
    $('syncButton').disabled = !roiActive;
    $('recognizeButton').classList.toggle('busy', !!controller);
    $('recognizeButton').querySelector('span').textContent = controller ? '识别中…' : complete ? '重新识别' : '开始识别';
  }
  function stopRun() {
    if (controller) { controller.abort(); controller = null; }
    firstPass = false;
    source.pause();
    roi.pause();
  }
  function clearResults() {
    roiActive = false;
    firstPass = false;
    complete = false;
    roi.pause();
    roi.removeAttribute('src');
    roi.load();
    roi.hidden = true;
    $('roiPlaceholder').hidden = false;
    $('roiHint').textContent = '等待唇部区域视频';
    $('roiSubhint').textContent = '载入视频，开始识别后在此预览';
    $('scanLine').hidden = true;
    $('roiMeta').textContent = '— × —';
    videoStatus($('roiStatus'), '等待处理');
    $('resultText').textContent = '';
    $('resultText').hidden = true;
    $('resultPlaceholder').hidden = false;
    $('resultBadge').textContent = '等待识别';
    $('resultBadge').classList.remove('complete');
    $('resultStatus').textContent = '准备就绪';
    $('resultCount').textContent = '藏语 · 拉萨话';
    $('resultDot').className = 'status-dot';
    $('progressTrack').hidden = true;
    $('progressFill').style.width = '0%';
    setStep(1);
  }
  function selectVideo(url, record) {
    stopRun();
    clearResults();
    message();
    ready = false;
    selected = record || null;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    objectUrl = url;
    source.hidden = false;
    $('uploadButton').hidden = true;
    $('replaceButton').hidden = false;
    $('sourceHint').hidden = true;
    $('sourceMeta').textContent = '载入中…';
    videoStatus($('sourceStatus'), '正在载入视频', 'warm');
    source.removeAttribute('poster');
    source.playbackRate = 1;
    source.src = url;
    source.load();
    // Call from the file-selection gesture; fall back to muted autoplay if necessary.
    autoplay(source);
    description('正在载入视频…');
    controls();
  }
  function reset() {
    stopRun();
    clearResults();
    ready = false;
    selected = null;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    source.removeAttribute('src');
    source.removeAttribute('poster');
    source.load();
    source.hidden = true;
    $('uploadButton').hidden = false;
    $('replaceButton').hidden = true;
    $('sourceHint').hidden = false;
    $('sourceMeta').textContent = 'LOCAL VIDEO';
    videoStatus($('sourceStatus'), '等待输入视频');
    $('fileInput').value = '';
    sync = true;
    $('syncButton').setAttribute('aria-pressed', 'true');
    message();
    description('选择本地视频，开始视觉语音识别');
    controls();
  }
  function upload(file) {
    if (!file) return;
    if (!/\.(mp4|mov|webm)$/i.test(file.name)) {
      message('请选择 MP4、MOV 或 WEBM 格式的视频文件。');
      return;
    }
    if (file.size === 0 || file.size > 500 * 1024 * 1024) {
      message(file.size === 0 ? '此文件为空，请重新选择视频。' : '视频超过 500 MB，请选择更小的文件。');
      return;
    }
    selectVideo(URL.createObjectURL(file), byId.get(videoId(file.name)));
  }
  source.addEventListener('loadedmetadata', () => {
    if (!source.hasAttribute('src')) return;
    ready = source.videoWidth > 0;
    $('sourceMeta').textContent = `${formatTime(source.duration)} · ${source.videoWidth} × ${source.videoHeight}`;
    videoStatus($('sourceStatus'), '视频已载入', 'green');
    if (selected && ready) {
      description('视频已就绪，点击「开始识别」查看对应的 ROI 与藏文结果');
    } else {
      description('此视频可预览，暂不支持识别');
      message('未找到此视频对应的处理数据，请从本地选择支持的四个视频之一，并保留原文件名称。');
    }
    controls();
  });
  source.addEventListener('error', () => {
    if (!source.hasAttribute('src')) return;
    stopRun();
    clearResults();
    ready = false;
    message('视频无法播放。请检查文件是否完整，并使用浏览器支持的视频格式。');
    videoStatus($('sourceStatus'), '视频载入失败', 'warm');
    $('sourceMeta').textContent = '—';
    description('请更换视频后重试');
    controls();
  });

  async function autoplay(video) {
    const expected = video.getAttribute('src');
    try { await video.play(); }
    catch (error) {
      if (video.getAttribute('src') !== expected || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError' && !video.muted) {
        video.muted = true;
        try { await video.play(); return; } catch { /* Native controls remain available. */ }
      }
      if (video.getAttribute('src') === expected && error.name === 'NotAllowedError')
        notify('自动播放受限，请点击视频中的播放按钮继续');
    }
  }
  function loadRoi(url, signal) {
    return new Promise((resolve, reject) => {
      const clear = () => {
        clearTimeout(timer);
        roi.removeEventListener('loadeddata', loaded);
        roi.removeEventListener('error', failed);
        signal.removeEventListener('abort', abort);
      };
      const loaded = () => { clear(); resolve(); };
      const failed = () => { clear(); reject(new Error('ROI_LOAD_FAILED')); };
      const abort = () => { clear(); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(failed, 12000);
      roi.addEventListener('loadeddata', loaded, { once: true });
      roi.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      roi.src = url;
      roi.preload = 'auto';
      roi.load();
      if (signal.aborted) abort();
    });
  }

  function watchedUntil() {
    // Only contiguous played ranges starting at zero count as one complete pass.
    let end = 0;
    for (let i = 0; i < roi.played.length; i++) {
      if (roi.played.start(i) > end + .15) break;
      end = Math.max(end, roi.played.end(i));
    }
    return end;
  }
  function playRoiOnce(signal) {
    return new Promise((resolve, reject) => {
      const clear = () => {
        roi.removeEventListener('ended', ended);
        roi.removeEventListener('error', failed);
        signal.removeEventListener('abort', abort);
      };
      const ended = () => {
        if (signal.aborted) return;
        const watched = watchedUntil();
        // A seek to the end must not release a result before the video is watched.
        if (!Number.isFinite(roi.duration) || watched < roi.duration - .15) {
          roi.currentTime = watched;
          description('请完整播放唇部视频，播放结束后将显示藏文结果');
          autoplay(roi);
          return;
        }
        clear();
        resolve();
      };
      const failed = () => { clear(); reject(new Error('ROI_PLAY_FAILED')); };
      const abort = () => { clear(); reject(new DOMException('Cancelled', 'AbortError')); };
      roi.addEventListener('ended', ended);
      roi.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      roi.currentTime = 0;
      roi.playbackRate = 1;
      autoplay(roi);
    });
  }
  async function recognize() {
    if (!selected || !ready || controller) return;
    clearResults();
    message();
    const record = selected;
    const run = new AbortController();
    controller = run;
    const { signal } = run;
    source.pause();
    source.currentTime = 0;
    controls();
    $('progressTrack').hidden = false;
    $('progressFill').style.width = '12%';
    $('resultBadge').textContent = '识别中';
    $('resultStatus').textContent = '正在准备唇部视频';
    videoStatus($('roiStatus'), '正在准备唇部视频', 'warm');
    $('roiHint').textContent = '正在准备唇部 ROI';
    $('roiSubhint').textContent = '即将展示对应的唇部动作视频';
    $('scanLine').hidden = false;
    description('正在读取视频…');
    try {
      setStep(2);
      $('progressFill').style.width = '25%';
      description('正在准备对应的唇部 ROI…');
      await loadRoi(record.roi, signal);
      roi.hidden = false;
      roiActive = true;
      firstPass = true;
      $('roiPlaceholder').hidden = true;
      $('scanLine').hidden = true;
      $('roiMeta').textContent = `${roi.videoWidth} × ${roi.videoHeight}`;
      videoStatus($('roiStatus'), '唇部视频播放中', 'green');
      $('progressFill').style.width = '55%';
      $('resultStatus').textContent = '正在读取唇部动作';
      description('唇部 ROI 正在播放，完整播放一遍后显示藏文结果');
      controls();
      await playRoiOnce(signal);
      firstPass = false;
      setStep(3);
      source.pause();
      $('resultText').textContent = record.text;
      $('resultText').hidden = false;
      $('resultPlaceholder').hidden = true;
      $('resultBadge').textContent = '识别完成';
      $('resultBadge').classList.add('complete');
      $('resultStatus').textContent = '识别结果已生成';
      videoStatus($('roiStatus'), '唇部视频已播放完成', 'green');
      $('resultDot').className = 'status-dot green';
      $('resultCount').textContent = '藏语 · 拉萨话 / UTF-8';
      $('progressFill').style.width = '100%';
      complete = true;
      setStep(3, true);
      description('识别完成，可播放对照视频或复制、导出藏文');
      $('progressTrack').hidden = true;
    } catch (error) {
      if (error.name === 'AbortError') return;
      clearResults();
      videoStatus($('roiStatus'), '视频载入失败', 'warm');
      $('resultBadge').textContent = '请重试';
      message('ROI 视频未能载入。请确认 assets/roi 文件夹完整，并使用 Chrome 或 Edge 打开页面。');
      description('处理未完成，请重试或重新选择本地视频');
    } finally {
      // A cancelled run must never overwrite a newer run's button state.
      if (controller === run) { controller = null; firstPass = false; controls(); }
    }
  }

  // Bidirectional transport sync, with a tolerance to avoid seek-event feedback loops.
  [source, roi].forEach((video, index) => {
    const other = index === 0 ? roi : source;
    video.addEventListener('play', () => {
      if (!roiActive || !sync) return;
      if (Number.isFinite(other.duration) && Math.abs(other.currentTime - video.currentTime) > .18)
        other.currentTime = Math.min(video.currentTime, Math.max(0, other.duration - .01));
      if (other.paused) other.play().catch(() => {});
    });
    video.addEventListener('pause', () => {
      // Source and ROI durations can differ slightly. Let the ROI reach its own end.
      if (roiActive && sync && !video.ended && !other.paused) other.pause();
    });
    video.addEventListener('seeking', () => {
      if (roiActive && sync && Number.isFinite(other.duration) && Math.abs(other.currentTime - video.currentTime) > .18)
        other.currentTime = Math.min(video.currentTime, Math.max(0, other.duration - .01));
    });
    video.addEventListener('ratechange', () => {
      if (roiActive && sync && other.playbackRate !== video.playbackRate) other.playbackRate = video.playbackRate;
    });
  });
  roi.addEventListener('timeupdate', () => {
    if (firstPass && Number.isFinite(roi.duration) && roi.duration > 0)
      $('progressFill').style.width = `${55 + Math.min(1, watchedUntil() / roi.duration) * 40}%`;
  });
  roi.addEventListener('playing', () => {
    if (!firstPass) return;
    videoStatus($('roiStatus'), '唇部视频播放中', 'green');
    $('resultStatus').textContent = '正在读取唇部动作';
    description('唇部 ROI 正在播放，完整播放一遍后显示藏文结果');
  });
  roi.addEventListener('pause', () => {
    if (!firstPass || roi.ended) return;
    videoStatus($('roiStatus'), '唇部视频已暂停', 'warm');
    $('resultStatus').textContent = '等待继续播放唇部视频';
    description('唇部视频已暂停，继续播放至结束后将显示藏文结果');
  });
  $('syncButton').addEventListener('click', () => {
    sync = !sync;
    $('syncButton').setAttribute('aria-pressed', String(sync));
    if (sync) {
      roi.currentTime = Math.min(source.currentTime, Math.max(0, roi.duration - .01));
      roi.playbackRate = source.playbackRate;
      if (source.paused) roi.pause();
      else roi.play().catch(() => {});
    }
    notify(sync ? '已开启视频同步播放' : '已关闭同步，可分别播放视频');
  });
  $('recognizeButton').addEventListener('click', recognize);
  $('resetButton').addEventListener('click', reset);
  ['uploadButton', 'replaceButton'].forEach(id => $(id).addEventListener('click', () => $('fileInput').click()));
  $('fileInput').addEventListener('change', event => { upload(event.target.files[0]); event.target.value = ''; });
  const drop = $('dropArea');
  let dragDepth = 0;
  drop.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; drop.classList.add('dragging'); });
  drop.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
  drop.addEventListener('dragleave', event => { event.preventDefault(); if (--dragDepth <= 0) drop.classList.remove('dragging'); });
  drop.addEventListener('drop', event => {
    event.preventDefault(); dragDepth = 0; drop.classList.remove('dragging');
    if (event.dataTransfer.files.length !== 1) { message('请每次选择一个视频。'); return; }
    upload(event.dataTransfer.files[0]);
  });
  // Prevent a drop outside the input region from navigating away from the workbench.
  document.addEventListener('dragover', event => { event.preventDefault(); });
  document.addEventListener('drop', event => { event.preventDefault(); });

  $('copyButton').addEventListener('click', async () => {
    if (!complete) return;
    const text = $('resultText').textContent;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('COPY_FAILED');
        $('copyButton').focus();
      }
      notify('藏文文本已复制');
    } catch { notify('复制未成功，请选中文本后手动复制'); }
  });
  $('downloadButton').addEventListener('click', () => {
    if (!complete) return;
    const blob = new Blob(['\ufeff', $('resultText').textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '藏文识别结果.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    notify('藏文结果已导出');
  });
  const dialog = $('helpDialog');
  $('helpButton').addEventListener('click', () => dialog.showModal());
  ['closeHelpButton', 'understoodButton'].forEach(id => $(id).addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  window.addEventListener('pagehide', () => { stopRun(); if (objectUrl) URL.revokeObjectURL(objectUrl); });
})();
