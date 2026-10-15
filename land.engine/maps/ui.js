// Long-view maps: play through the years, and shrink the info/legend panels.
(() => {
  const yc = document.getElementById("years"); if (!yc) return;
  const css = document.createElement("style");
  css.textContent = ".yb.play{border-color:#ff7a45;color:#fff;background:rgba(255,122,69,.25)}" +
    ".panel{position:absolute}.tg{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:4px;border:1px solid #2a323c;background:#0b0d10;color:#9aa4b1;font:12px/1 monospace;cursor:pointer;z-index:2}" +
    ".panel.min>*:not(.tg):not(h2):not(h3):not(.yr){display:none}.panel.min{padding-right:30px}";
  document.head.appendChild(css);
  const btns = () => [...yc.querySelectorAll(".yb:not(.play)")];
  const play = document.createElement("div"); play.className = "yb play"; play.textContent = "▶ play"; yc.prepend(play);
  let t = null;
  const stop = () => { clearInterval(t); t = null; play.textContent = "▶ play"; };
  play.onclick = () => {
    if (t) return stop();
    const bs = btns(); let i = bs.findIndex((b) => b.classList.contains("on"));
    if (i < 0 || i >= bs.length - 1) i = -1;
    play.textContent = "❚❚ pause";
    t = setInterval(() => { i++; if (i >= bs.length) return stop(); bs[i].click(); }, 800);
  };
  yc.addEventListener("click", (e) => { if (t && e.isTrusted && !e.target.classList.contains("play")) stop(); });
  document.querySelectorAll(".panel.info, .panel.legend").forEach((p) => {
    const b = document.createElement("button"); b.className = "tg"; b.type = "button"; b.textContent = "–"; b.title = "Shrink / expand";
    b.onclick = () => { const on = p.classList.toggle("min"); b.textContent = on ? "+" : "–"; };
    p.prepend(b);
  });
})();
