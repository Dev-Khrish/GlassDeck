const tracks = ['Midnight Current', 'Blue Hours', 'Northbound'];
const noteDefault = 'Try the tablet layout.\nRearrange two widgets.\nSave a workspace of your own.';
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const twoDigits = value => String(value).padStart(2, '0');
const secondsLeft = (local, now) => local.until ? Math.max(0, Math.ceil((local.until - now) / 1000)) : local.left;

function button(action, label, glyph) {
  return '<button class="widget-button" type="button" data-action="' + action + '" aria-label="' + label + '">' + glyph + '</button>';
}

function drawChart(canvas, values) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#c0dcff28';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(n => {
    ctx.beginPath(); ctx.moveTo(0, height * n); ctx.lineTo(width, height * n); ctx.stroke();
  });
  if (values.length < 2) return;
  const points = values.map((value, i) => [width * i / (values.length - 1), height * (.94 - value * .0087)]);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#92caff6b'); grad.addColorStop(1, '#92caff04');
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.lineTo(points.at(-1)[0], height); ctx.lineTo(0, height); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#a9d4ff'; ctx.stroke();
}

function createView(body, widget, local, editor, saveText) {
  const type = widget.type;
  if (type === 'clock') {
    body.innerHTML = '<div class="clock-face"><div class="clock-time"></div><div class="clock-date"></div></div>';
  } else if (type === 'telemetry') {
    body.innerHTML = '<div class="telemetry-content"><div class="stat-row"><span>CPU <strong data-cpu>—</strong></span><span>RAM <strong data-memory>—</strong></span></div><canvas class="sparkline" width="500" height="110" aria-label="Recent CPU activity"></canvas><div class="stat-foot">Waiting for Windows</div></div>';
  } else if (type === 'mixer') {
    local.levels ||= [72, 51, 64];
    body.innerHTML = '<div class="demo-mixer">' + ['System', 'Music', 'Voice'].map((name, i) =>
      '<label class="mix-channel"><span>' + name + '</span><input type="range" min="0" max="100" data-level="' + i + '" aria-label="' + name + ' sample volume"><output></output></label>').join('') + '</div>';
    body.querySelectorAll('input').forEach((el, i) => { el.value = local.levels[i]; });
    body.addEventListener('input', event => {
      const input = event.target.closest('[data-level]');
      if (input) {
        local.levels[Number(input.dataset.level)] = Number(input.value);
        input.nextElementSibling.value = input.value + '%';
      }
    });
  } else if (type === 'media') {
    local.track ??= 0;
    local.position ??= 53;
    body.innerHTML = '<div class="media-layout"><div class="media-info"><div class="media-art" aria-hidden="true"></div><div class="media-content"><div class="media-title"></div><div class="media-subtitle">Demo playback</div></div></div>'
      + '<div class="media-progress" aria-hidden="true"><i></i></div><div class="media-controls">'
      + button('previous', 'Previous sample track', '◀') + button('play', 'Play sample', '▶') + button('next', 'Next sample track', '▶|') + '</div></div>';
  } else if (type === 'shortcuts') {
    local.toggles ||= {};
    const labels = [['focus', '◉', 'Focus'], ['ambient', '☼', 'Ambient'], ['quiet', '◌', 'Quiet'], ['studio', '▦', 'Studio']];
    body.innerHTML = '<div class="quick-grid">' + labels.map(([id, icon, label]) =>
      '<button class="widget-button" type="button" data-action="' + id + '" aria-pressed="false"><i aria-hidden="true">' + icon + '</i><span>' + label + '</span></button>').join('') + '</div>';
  } else if (type === 'focus') {
    local.left ??= 25 * 60;
    body.innerHTML = '<div class="focus-content"><div class="focus-time"></div><div class="focus-actions">' + button('toggle', 'Start focus timer', 'Start') + button('reset', 'Reset focus timer', 'Reset') + '</div></div>';
  } else if (type === 'notes') {
    body.innerHTML = '<div class="notes-body"></div>';
    const target = body.firstElementChild;
    if (editor) {
      const input = document.createElement('textarea');
      input.setAttribute('aria-label', 'Notes');
      input.maxLength = 600;
      input.value = widget.text ?? noteDefault;
      input.addEventListener('change', () => saveText(input.value));
      target.append(input);
    } else target.textContent = widget.text ?? noteDefault;
  } else if (type === 'weather') {
    body.innerHTML = '<div class="weather-body"><div class="weather-temp">16°</div><strong>Cloud cover</strong><span class="muted">Sample forecast</span></div>';
  }

  body.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const now = Date.now();
    if (type === 'media') {
      if (action === 'play') {
        if (local.playAt) {
          local.position += (now - local.playAt) / 1000;
          local.playAt = 0;
        } else local.playAt = now;
      } else {
        local.track = (local.track + (action === 'next' ? 1 : tracks.length - 1)) % tracks.length;
        local.position = 0;
        if (local.playAt) local.playAt = now;
      }
    } else if (type === 'focus') {
      if (action === 'reset') { local.left = 25 * 60; local.until = 0; }
      else if (local.until) { local.left = secondsLeft(local, now); local.until = 0; }
      else if (local.left > 0) local.until = now + local.left * 1000;
    } else if (type === 'shortcuts') local.toggles[action] = !local.toggles[action];
    view.update({ now });
  });

  let oldStats;
  const view = {
    update({ now = Date.now(), stats, history }) {
      if (type === 'clock') {
        body.querySelector('.clock-time').textContent = timeFormat.format(now);
        body.querySelector('.clock-date').textContent = dateFormat.format(now);
      } else if (type === 'telemetry' && stats && stats !== oldStats) {
        oldStats = stats;
        body.querySelector('[data-cpu]').textContent = stats.cpu + '%';
        body.querySelector('[data-memory]').textContent = stats.memory + '%';
        body.querySelector('.stat-foot').textContent = stats.cores + ' logical cores · Live from Windows';
        drawChart(body.querySelector('canvas'), history);
      } else if (type === 'mixer') {
        body.querySelectorAll('output').forEach((el, i) => { el.value = local.levels[i] + '%'; });
      } else if (type === 'media') {
        const position = local.position + (local.playAt ? (now - local.playAt) / 1000 : 0);
        if (position >= 218 && local.playAt) {
          local.track = (local.track + 1) % tracks.length;
          local.position = 0; local.playAt = now;
        }
        body.querySelector('.media-title').textContent = tracks[local.track];
        body.querySelector('.media-progress i').style.transform = 'scaleX(' + Math.min(1, position / 218) + ')';
        const play = body.querySelector('[data-action="play"]');
        play.textContent = local.playAt ? 'Ⅱ' : '▶';
        play.setAttribute('aria-label', local.playAt ? 'Pause sample' : 'Play sample');
      } else if (type === 'shortcuts') {
        body.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(!!local.toggles[el.dataset.action])));
      } else if (type === 'focus') {
        const remaining = secondsLeft(local, now);
        if (!remaining && local.until) { local.until = 0; local.left = 0; }
        body.querySelector('.focus-time').textContent = twoDigits(Math.floor(remaining / 60)) + ':' + twoDigits(remaining % 60);
        const toggle = body.querySelector('[data-action="toggle"]');
        toggle.textContent = local.until ? 'Pause' : 'Start';
        toggle.setAttribute('aria-label', local.until ? 'Pause focus timer' : 'Start focus timer');
      }
    },
  };
  view.update({});
  return view;
}

export { createView };
