/* Shared canvas zoom/pan for realtime and historical readings. */
(function (global) {
  "use strict";
  function boundedWindow(start, span) {
    span = Math.min(1, Math.max(1 / 256, span));
    start = Math.max(0, Math.min(1 - span, start));
    return { start, end: start + span };
  }
  function zoomWindow(view, factor, anchor) {
    anchor = Math.max(0, Math.min(1, anchor));
    const oldSpan = view.end - view.start;
    const span = Math.min(1, Math.max(1 / 256, oldSpan / factor));
    return boundedWindow(view.start + anchor * (oldSpan - span), span);
  }
  function panWindow(view, fraction) {
    const span = view.end - view.start;
    return boundedWindow(view.start - fraction * span, span);
  }
  function lowerBound(data, time) {
    let lo = 0, hi = data.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (+data[mid].time < time) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  function attach(canvas, getData, tooltip) {
    const ctx = canvas.getContext("2d");
    const toolbar = document.querySelector('[data-chart-tools="' + canvas.id + '"]');
    const status = toolbar.querySelector(".chart-zoom-status");
    const pointers = new Map();
    let view = { start: 0, end: 1 }, frame = 0, moved = false, gesture = null;
    const pad = { left: 42, right: 18, top: 20, bottom: 48 };
    function geometry() {
      const rect = canvas.getBoundingClientRect();
      return { rect, width: Math.max(1, rect.width - pad.left - pad.right),
        height: Math.max(1, rect.height - pad.top - pad.bottom) };
    }
    function timeWindow(data) {
      const first = data.length ? +data[0].time : 0;
      const span = data.length > 1 ? Math.max(1, +data[data.length - 1].time - first) : 1000;
      return { first, span, from: first + span * view.start, to: first + span * view.end };
    }
    function label(time, seconds) {
      return new Date(time).toLocaleTimeString("vi-VN", {
        hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {})
      });
    }
    function hide() { tooltip.classList.remove("is-visible"); }
    function draw() {
      const { rect, width, height } = geometry();
      if (!rect.width || !rect.height) return;
      const data = getData(), times = timeWindow(data);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.font = "11px system-ui, sans-serif";
      ctx.strokeStyle = "#e2e9e3"; ctx.fillStyle = "#66736d"; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + height * i / 4;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + width, y); ctx.stroke();
      }
      ctx.textAlign = "left";
      ctx.fillText("40°C / 100%", 4, 13);
      ctx.fillText("18°C / 30%", 4, pad.top + height + 12);
      toolbar.querySelectorAll("button").forEach(button => button.disabled = data.length < 2);
      if (!data.length) { status.textContent = "Chưa có dữ liệu"; return; }
      const zoom = 1 / (view.end - view.start);
      status.textContent = "Zoom " + zoom.toFixed(zoom < 10 ? 1 : 0) + "×";
      const ticks = Math.max(1, Math.floor(width / 100));
      for (let i = 0; i <= ticks; i++) {
        const time = times.from + (times.to - times.from) * i / ticks;
        const x = pad.left + width * i / ticks;
        ctx.textAlign = i === 0 ? "left" : i === ticks ? "right" : "center";
        ctx.fillText(label(time, times.to - times.from < 120000), x, rect.height - 22);
        ctx.fillText(new Date(time).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), x, rect.height - 7);
      }
      const begin = Math.max(0, lowerBound(data, times.from) - 1);
      const end = Math.min(data.length, lowerBound(data, times.to) + 1);
      ctx.save(); ctx.beginPath(); ctx.rect(pad.left, pad.top, width, height); ctx.clip();
      for (const [field, color, min, max] of [
        ["temperature", "#d95f48", 18, 40], ["humidity", "#2d7fb8", 30, 100]
      ]) {
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = begin; i < end; i++) {
          const x = pad.left + (+data[i].time - times.from) / (times.to - times.from) * width;
          const normalized = Math.max(0, Math.min(1, (data[i][field] - min) / (max - min)));
          const y = pad.top + height * (1 - normalized);
          if (i === begin) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          if (data.length === 1) { ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    function schedule() {
      hide();
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); });
    }
    function reset() { view = { start: 0, end: 1 }; schedule(); }
    function zoom(factor, anchor = 0.5) { view = zoomWindow(view, factor, anchor); schedule(); }
    function fraction(clientX) {
      const { rect, width } = geometry();
      return Math.max(0, Math.min(1, (clientX - rect.left - pad.left) / width));
    }
    function show(event) {
      const data = getData(); if (!data.length) return hide();
      const { rect, width, height } = geometry();
      if (event.clientX < rect.left + pad.left || event.clientX > rect.left + pad.left + width ||
          event.clientY < rect.top + pad.top || event.clientY > rect.top + pad.top + height) return hide();
      const times = timeWindow(data);
      const time = times.from + fraction(event.clientX) * (times.to - times.from);
      let i = Math.min(data.length - 1, lowerBound(data, time));
      if (i > 0 && time - +data[i - 1].time < +data[i].time - time) i--;
      const reading = data[i];
      if (+reading.time < times.from || +reading.time > times.to) return hide();
      const value = document.createElement("strong"), date = document.createElement("span");
      value.textContent = reading.temperature.toFixed(1) + "°C · " + reading.humidity.toFixed(1) + "%";
      date.textContent = reading.time.toLocaleString("vi-VN");
      tooltip.replaceChildren(value, date);
      const card = canvas.closest(".chart-card, .history-card").getBoundingClientRect();
      tooltip.style.left = Math.max(80, Math.min(card.width - 80, event.clientX - card.left)) + "px";
      tooltip.style.top = (event.clientY - card.top) + "px";
      tooltip.className = "chart-tooltip is-visible";
    }
    function rebase() {
      const points = [...pointers.values()];
      gesture = points.length >= 2
        ? { center: (points[0].x + points[1].x) / 2,
            distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)) }
        : points.length ? { x: points[0].x } : null;
    }
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || getData().length < 2) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId); moved = false; rebase();
    });
    canvas.addEventListener("pointermove", event => {
      if (!pointers.has(event.pointerId)) return show(event);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const previous = gesture; rebase();
      const width = geometry().width;
      if (previous && gesture && pointers.size >= 2 && previous.distance) {
        view = zoomWindow(view, gesture.distance / previous.distance, fraction(previous.center));
        view = panWindow(view, (gesture.center - previous.center) / width);
        moved = true; schedule();
      } else if (previous && gesture && previous.x !== undefined) {
        const delta = gesture.x - previous.x;
        if (Math.abs(delta) > 0) {
          view = panWindow(view, delta / width); moved = true; schedule();
        }
      }
    });
    function release(event) {
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!moved && event.type === "pointerup") show(event);
      rebase();
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, release);
    canvas.addEventListener("pointerleave", () => { if (!pointers.size) hide(); });
    canvas.addEventListener("wheel", event => {
      if (getData().length < 2) return;
      event.preventDefault();
      zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.01), fraction(event.clientX));
    }, { passive: false });
    canvas.addEventListener("keydown", event => {
      if (event.key === "+" || event.key === "=") zoom(2);
      else if (event.key === "-") zoom(0.5);
      else if (event.key === "0" || event.key === "Home") reset();
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        view = panWindow(view, event.key === "ArrowLeft" ? 0.2 : -0.2); schedule();
      } else return;
      event.preventDefault();
    });
    toolbar.addEventListener("click", event => {
      const action = event.target.closest("button")?.dataset.zoom;
      if (action === "in") zoom(2);
      if (action === "out") zoom(0.5);
      if (action === "reset") reset();
    });
    return { draw, reset };
  }
  global.GreenhouseChartZoom = { attach, boundedWindow, zoomWindow, panWindow, lowerBound };
})(window);
