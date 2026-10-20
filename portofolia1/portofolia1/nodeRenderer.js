function loadLevel(node, titleText, fontSize) {
  window.MC_CURSOR_SYSTEM?.onViewChange?.();

  categoryPage.scrollTop = 0;
  smallGrid.innerHTML = "";
  title.innerText = titleText;

  history.push({
    node,
    title: titleText,
    fontSize
  });

  renderBreadcrumb();
  smallGrid.style.position = "relative";

  const parsed = TreeReader.parseNode(node);

  parsed.blocks.forEach((block) => {
    renderBlock(block, fontSize);
  });

  if (parsed.items.length) {
    const itemsWrap = document.createElement("div");
    itemsWrap.className = "treeItems";

    parsed.items.forEach(({ key, preview, kind, navigation }) => {
      const el = document.createElement("div");
      el.className = "emptyBox treeItem";

      const titleEl = document.createElement("div");
      titleEl.className = "treeItemTitle";
      titleEl.innerText = key;
      el.appendChild(titleEl);

      if (preview) {
        const previewEl = document.createElement("div");
        previewEl.className = "treeItemPreview";
        previewEl.innerText = preview;
        el.appendChild(previewEl);
      }

      const badge = document.createElement("div");
      badge.className = "treeItemBadge";
      badge.innerText = kind === "branch" ? "Se mer" : "Detaljer";
      el.appendChild(badge);

      el.onclick = () => {
        if (navigation.mode === "final") {
          loadFinal(navigation.payload, key);
        } else {
          loadLevel(navigation.payload, key, fontSize);
        }
      };

      itemsWrap.appendChild(el);
    });

    place(itemsWrap, { width: "100%" });
  }
}

function renderBreadcrumb() {
  let trail = document.getElementById("breadcrumbTrail");
  if (!trail) {
    trail = document.createElement("div");
    trail.id = "breadcrumbTrail";
    trail.className = "breadcrumbTrail";
    document.querySelector(".topbar").appendChild(trail);
  }

  trail.innerHTML = "";

  const crumbs = history.slice(0, -1);
  if (!crumbs.length) {
    trail.style.display = "none";
    return;
  }

  trail.style.display = "flex";

  crumbs.forEach((entry, index) => {
    if (index > 0) {
      const sep = document.createElement("span");
      sep.className = "breadcrumbSep";
      sep.innerText = "/";
      trail.appendChild(sep);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "breadcrumbLink";
    btn.innerText = entry.title;
    btn.onclick = () => {
      history = history.slice(0, index + 1);
      const current = history[history.length - 1];
      history.pop();
      loadLevel(current.node, current.title, current.fontSize);
    };
    trail.appendChild(btn);
  });
}

function renderBlock(block, baseFontSize) {
  switch (block.type) {
    case "row": {
      const row = document.createElement("div");
      row.className = "contentRow";
      row.style.gap = `${block.gap || 16}px`;
      block.items.forEach((child) => {
        const childEl = renderBlockElement(child, baseFontSize);
        if (childEl) {
          row.appendChild(wrapContentBlock(childEl, child));
        }
      });
      return place(row, block.style || { width: "100%" });
    }

    case "heading":
      return place(
        wrapContentBlock(createTextEl(block.value, textStyles(block, baseFontSize, {
          tag: "h3",
          className: "contentHeading",
          defaultSize: "clamp(20px, 2.4vw, 28px)",
          opacity: "1"
        })), block),
        block.style
      );

    case "text":
    case "text2":
      return place(
        wrapContentBlock(createTextEl(block.value, textStyles(block, baseFontSize, {
          opacity: "0.85"
        })), block),
        block.style
      );

    case "note":
      return place(
        wrapContentBlock(createTextEl(block.value, textStyles(block, baseFontSize, {
          defaultSize: "13px",
          opacity: "0.5"
        })), block),
        block.style
      );

    case "quote":
      return place(
        wrapContentBlock(createTextEl(block.value, textStyles(block, baseFontSize, {
          tag: "blockquote",
          className: "contentQuote",
          opacity: "0.9"
        })), block),
        block.style
      );

    case "image":
      return place(wrapContentBlock(createImageEl(block), block), block.style);

    case "video":
      return place(wrapContentBlock(createVideoEl(block), block), block.style);

    case "link":
      return place(wrapContentBlock(createLinkEl(block), block), block.style);

    case "html":
      return place(wrapContentBlock(createHtmlEl(block.value, block.style), block), block.style);

    case "action":
      return place(wrapContentBlock(createActionEl(block), block), block.style);

    default:
      return null;
  }
}

function renderBlockElement(block, baseFontSize) {
  switch (block.type) {
    case "heading":
      return createTextEl(block.value, textStyles(block, baseFontSize, {
        tag: "h3",
        className: "contentHeading",
        defaultSize: "clamp(20px, 2.4vw, 28px)",
        opacity: "1"
      }));
    case "text":
    case "text2":
      return createTextEl(block.value, textStyles(block, baseFontSize, { opacity: "0.85" }));
    case "note":
      return createTextEl(block.value, textStyles(block, baseFontSize, {
        defaultSize: "13px",
        opacity: "0.5"
      }));
    case "quote":
      return createTextEl(block.value, textStyles(block, baseFontSize, {
        tag: "blockquote",
        className: "contentQuote",
        opacity: "0.9"
      }));
    case "image":
      return createImageEl(block);
    case "video":
      return createVideoEl(block);
    case "link":
      return createLinkEl(block);
    case "html":
      return createHtmlEl(block.value, block.style);
    case "action":
      return createActionEl(block);
    default:
      return null;
  }
}

function textStyles(block, baseFontSize, defaults = {}) {
  const style = block.style || {};
  return {
    tag: defaults.tag,
    className: defaults.className,
    fontSize: style.fontSize || defaults.defaultSize || baseFontSize,
    fontWeight: style.fontWeight,
    textAlign: style.align,
    opacity: defaults.opacity
  };
}

function wrapContentBlock(el, block) {
  const wrap = document.createElement("div");
  wrap.className = "contentBlock";
  applyBlockStyle(wrap, block.style);
  wrap.appendChild(el);
  return wrap;
}

function applyBlockStyle(el, style = {}) {
  const width = style.width || "100%";
  const isFull = width === "100%";

  el.style.minWidth = "0";
  el.style.flex = "1 1 0";
  el.style.width = isFull ? "100%" : "auto";
  el.style.maxWidth = style.maxWidth || width;

  const align = style.align || "center";
  el.classList.remove("contentBlock--align-left", "contentBlock--align-center", "contentBlock--align-right");
  el.classList.add(`contentBlock--align-${align}`);
}

function createTextEl(value, styles = {}) {
  const el = document.createElement(styles.tag || "p");
  el.innerText = value;
  el.style.margin = "0";
  if (styles.className) el.className = styles.className;
  if (styles.fontSize) el.style.fontSize = styles.fontSize;
  if (styles.fontWeight) el.style.fontWeight = styles.fontWeight;
  if (styles.textAlign) el.style.textAlign = styles.textAlign;
  if (styles.opacity) el.style.opacity = styles.opacity;
  return el;
}

function createImageEl(block) {
  const wrap = document.createElement("figure");
  wrap.className = "mediaBlock";

  const img = document.createElement("img");
  img.src = block.src;
  img.style.width = "100%";
  img.style.borderRadius = "12px";
  img.style.objectFit = block.fit || "cover";
  wrap.appendChild(img);

  if (block.caption) {
    const cap = document.createElement("figcaption");
    cap.innerText = block.caption;
    wrap.appendChild(cap);
  }

  return wrap;
}

function createVideoEl(block) {
  const wrap = document.createElement("figure");
  wrap.className = "mediaBlock";

  const video = document.createElement("video");
  video.src = block.src;
  video.controls = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.style.width = "100%";
  video.style.borderRadius = "12px";
  wrap.appendChild(video);

  if (block.caption) {
    const cap = document.createElement("figcaption");
    cap.innerText = block.caption;
    wrap.appendChild(cap);
  }

  return wrap;
}

function createLinkEl(block) {
  const a = document.createElement("a");
  a.className = "contentLink";
  a.href = block.href;
  a.innerText = block.label;
  if (block.external) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  return a;
}

function createHtmlEl(value, style = {}) {
  const el = document.createElement("div");
  el.className = "contentHtml";
  el.innerHTML = value;
  if (style.fontSize) el.style.fontSize = style.fontSize;
  if (style.fontWeight) el.style.fontWeight = style.fontWeight;
  if (style.align) el.style.textAlign = style.align;
  return el;
}

function createActionEl(block) {
  const btn = document.createElement("div");
  btn.className = "emptyBox";
  btn.innerText = block.label || "Run Action";
  btn.onclick = () => block.handler?.();
  return btn;
}

function place(el, style = {}) {
  applyBlockStyle(el, style);
  smallGrid.appendChild(el);
}

