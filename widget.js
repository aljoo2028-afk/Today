// Today — home screen widget for the Scriptable app.
// Shows the tasks you still have to do today, read from the private note the Today app keeps updated.
// Works in small, medium and large widget sizes.

const WIDGET_ID = "PASTE_WIDGET_ID_HERE";

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "today-widget-cache.json");

const C = {
  bg: Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e")),
  text: Color.dynamic(new Color("#1b1b1a"), new Color("#f2f2f0")),
  muted: Color.dynamic(new Color("#6d6b66"), new Color("#9a9893")),
  accent: Color.dynamic(new Color("#2f6fed"), new Color("#5b8ff9")),
  star: Color.dynamic(new Color("#e0a100"), new Color("#f5c242")),
  track: Color.dynamic(new Color("#efede7"), new Color("#2a2a2c")),
};

async function getData() {
  try {
    const req = new Request(`https://api.github.com/gists/${WIDGET_ID}`);
    req.headers = { Accept: "application/vnd.github+json" };
    req.timeoutInterval = 15;
    const gist = await req.loadJSON();
    const file = gist.files && gist.files["today.json"];
    if (!file) throw new Error(gist.message || "No data yet");
    let content = file.content;
    if (file.truncated) content = await new Request(file.raw_url).loadString();
    JSON.parse(content); // make sure it's valid before caching
    fm.writeString(cachePath, content);
    return JSON.parse(content);
  } catch (e) {
    // offline or GitHub hiccup: show the last list we got
    if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath));
    return { error: "Couldn't load your tasks yet. Open the Today app once, then check back." };
  }
}

function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addRow(parent, task, isMust, fontSize) {
  const row = parent.addStack();
  row.centerAlignContent();
  row.spacing = 7;
  const sym = SFSymbol.named(isMust ? "star.fill" : "circle");
  sym.applyFont(Font.systemFont(fontSize));
  const icon = row.addImage(sym.image);
  icon.imageSize = new Size(fontSize, fontSize);
  icon.tintColor = isMust ? C.star : task.color ? new Color(task.color) : C.muted;
  const t = row.addText(task.title);
  t.font = isMust ? Font.semiboldSystemFont(fontSize) : Font.systemFont(fontSize);
  t.textColor = C.text;
  t.lineLimit = 1;
  if (isMust && task.color) {
    row.addSpacer();
    const dot = row.addStack();
    dot.size = new Size(7, 7);
    dot.cornerRadius = 3.5;
    dot.backgroundColor = new Color(task.color);
  }
}

async function build() {
  const data = await getData();
  const family = config.widgetFamily || "large";
  const small = family === "small";
  const fontSize = small ? 12 : 13;
  const maxRows = { small: 4, medium: 4, large: 11, extraLarge: 11 }[family] || 6;

  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(small ? 12 : 14, 14, small ? 12 : 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  // header
  const head = w.addStack();
  head.centerAlignContent();
  const title = head.addText("Today");
  title.font = Font.boldSystemFont(small ? 15 : 16);
  title.textColor = C.accent;
  head.addSpacer();
  if (!data.error && data.total) {
    const count = head.addText(`${data.done}/${data.total}`);
    count.font = Font.semiboldSystemFont(small ? 12 : 13);
    count.textColor = C.muted;
  }
  w.addSpacer(small ? 6 : 8);

  if (data.error) {
    const e = w.addText(data.error);
    e.font = Font.systemFont(12);
    e.textColor = C.muted;
    w.addSpacer();
    return w;
  }

  const stale = data.date !== localYMD();
  const must = data.must || [], rest = data.rest || [];
  const left = must.length + rest.length;

  if (stale) {
    const s = w.addText(left ? "From yesterday. Open Today to plan your day." : "Open Today to plan your day.");
    s.font = Font.mediumSystemFont(small ? 11 : 12);
    s.textColor = C.muted;
    w.addSpacer(6);
  }

  if (!left && !stale) {
    const msg = w.addText(data.total ? "All done for today 🎉" : "Nothing planned yet. Open Today and add a few tasks.");
    msg.font = Font.mediumSystemFont(fontSize);
    msg.textColor = C.text;
  } else {
    const list = w.addStack();
    list.layoutVertically();
    list.spacing = small ? 5 : 6;
    let shown = 0;
    for (const t of must) { if (shown >= maxRows) break; addRow(list, t, true, fontSize); shown++; }
    for (const t of rest) { if (shown >= maxRows) break; addRow(list, t, false, fontSize); shown++; }
    if (left > shown) {
      const more = list.addText(`+${left - shown} more`);
      more.font = Font.systemFont(small ? 11 : 12);
      more.textColor = C.muted;
    }
  }

  w.addSpacer();

  // goals footer (large only)
  if (family === "large" || family === "extraLarge") {
    const goals = data.goals || [];
    if (goals.length) {
      const g = w.addStack();
      g.layoutVertically();
      g.spacing = 3;
      const label = g.addText("GOALS");
      label.font = Font.semiboldSystemFont(10);
      label.textColor = C.muted;
      for (const goal of goals) {
        const r = g.addStack();
        r.centerAlignContent();
        r.spacing = 6;
        const dot = r.addStack();
        dot.size = new Size(6, 6);
        dot.cornerRadius = 3;
        dot.backgroundColor = new Color(goal.color || "#888888");
        const gt = r.addText(goal.title);
        gt.font = Font.systemFont(11);
        gt.textColor = C.muted;
        gt.lineLimit = 1;
      }
    }
  }
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
