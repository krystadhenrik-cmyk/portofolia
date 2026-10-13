/**

 * Normalizes and interprets window.TREE nodes for rendering.

 * Order follows how you write the node (object key order or content[] order).

 * Per-asset layout: width, align, row groups.

 */

(function () {

  const MEDIA_KEYS = new Set(["image", "video", "images", "videos"]);

  const TEXT_KEYS = new Set(["text", "text2", "note"]);

  const STRUCTURAL_KEYS = new Set(["items", "card", "meta", "layout", "actionLabel"]);



  const WIDTH_ALIASES = {
    full: "100%",
    half: "50%",
    third: "33.333%",
    quarter: "25%",
    sm: "min(100%, 320px)",
    md: "min(100%, 560px)",
    lg: "min(100%, 760px)",
    "screen-full": "min(100%, 96vw)",
    "screen-half": "min(100%, 50vw)",
    "screen-third": "min(100%, 33vw)",
    "screen-quarter": "min(100%, 25vw)"
  };

  const FONT_SIZE_ALIASES = {
    xs: "clamp(12px, 2.2vw, 14px)",
    sm: "clamp(14px, 2.5vw, 16px)",
    md: "clamp(16px, 2.8vw, 18px)",
    lg: "clamp(20px, 3.4vw, 24px)",
    xl: "clamp(26px, 4.2vw, 32px)"
  };

  const FONT_WEIGHT_ALIASES = {
    light: "300",
    normal: "400",
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800"
  };



  function isObject(value) {

    return value !== null && typeof value === "object" && !Array.isArray(value);

  }



  function truncate(text, max = 120) {

    if (!text || typeof text !== "string") return "";

    const trimmed = text.trim();

    if (trimmed.length <= max) return trimmed;

    return trimmed.slice(0, max).trimEnd() + "…";

  }



  function resolveWidth(width) {

    if (width == null || width === "") return null;

    if (typeof width === "number") {

      if (width <= 1) return `${width * 100}%`;

      if (width <= 100) return `${width}%`;

      return `${width}px`;

    }

    if (typeof width === "string") {

      return WIDTH_ALIASES[width] || width;

    }

    return null;

  }



  function resolveFontSize(size) {
    if (size == null || size === "") return null;
    if (typeof size === "number") {
      if (size <= 4) {
        return `clamp(${Math.round(size * 10)}px, ${size * 2.6}vw, ${Math.round(size * 14)}px)`;
      }
      return `${size}px`;
    }
    if (typeof size === "string") {
      return FONT_SIZE_ALIASES[size] || size;
    }
    return null;
  }

  function resolveFontWeight(weight, bold) {
    if (weight == null && bold == null) return null;
    if (bold === true) return "700";
    if (weight == null) return null;
    if (typeof weight === "number") return String(weight);
    if (typeof weight === "boolean") return weight ? "700" : "400";
    return FONT_WEIGHT_ALIASES[weight] || String(weight);
  }

  function normalizeStyle(entry) {
    if (!isObject(entry)) return {};

    const align = entry.align || entry.textAlign;
    const width = resolveWidth(entry.width ?? entry.w ?? entry.screen);
    const maxWidth = resolveWidth(entry.maxWidth ?? entry.maxW);
    const fontSize = resolveFontSize(entry.fontSize ?? entry.size ?? entry.font);
    const fontWeight = resolveFontWeight(entry.fontWeight ?? entry.weight, entry.bold);
    const style = {};

    if (width) style.width = width;
    if (maxWidth) style.maxWidth = maxWidth;
    if (fontSize) style.fontSize = fontSize;
    if (fontWeight) style.fontWeight = fontWeight;
    if (align === "left" || align === "center" || align === "right") {
      style.align = align;
    }

    return style;
  }



  function withStyle(block, entry) {

    if (!block) return null;

    const style = normalizeStyle(entry);

    if (Object.keys(style).length) {

      block.style = style;

    }

    return block;

  }



  function mediaBlock(type, value, entry) {

    if (!value) return null;



    let block;

    if (typeof value === "string") {

      block = { type, src: value, fit: "cover" };

    } else if (isObject(value) && value.src) {

      block = {

        type,

        src: value.src,

        fit: value.fit || "cover",

        caption: value.caption || ""

      };

    } else {

      return null;

    }



    return withStyle(block, isObject(entry) ? entry : isObject(value) ? value : {});

  }



  function textBlock(type, value, entry) {

    if (value == null || value === "") return null;

    const block = { type, value: String(value) };

    return withStyle(block, isObject(entry) ? entry : {});

  }



  function normalizeContentEntry(entry) {

    if (typeof entry === "string") {

      return textBlock("text", entry);

    }



    if (!isObject(entry) || !entry.type) return null;



    switch (entry.type) {

      case "text":

      case "text2":

      case "note":

      case "heading":

      case "quote":

        return textBlock(entry.type, entry.value ?? entry.text ?? "", entry);



      case "image":

      case "video":

        return mediaBlock(entry.type, entry, entry);



      case "link":

        return withStyle(

          {

            type: "link",

            href: entry.href || entry.url || "#",

            label: entry.label || entry.text || entry.href || "Link",

            external: entry.external !== false

          },

          entry

        );



      case "html":

        return withStyle(

          { type: "html", value: entry.value || entry.html || "" },

          entry

        );



      case "row": {

        const items = entry.items || entry.content || [];

        return withStyle(

          {

            type: "row",

            gap: entry.gap ?? 16,

            items: items.map(normalizeContentEntry).filter(Boolean)

          },

          entry

        );

      }



      default:

        return null;

    }

  }



  function blocksFromContentArray(content) {

    if (!Array.isArray(content)) return [];

    return content.map(normalizeContentEntry).filter(Boolean);

  }



  function emitBlocksForKey(node, key) {

    const value = node[key];

    const blocks = [];



    if (key === "title") {
      const titleValue = isObject(value) && value.value != null ? value.value : value;
      const titleEntry = isObject(value) && value.value != null ? value : {};
      blocks.push(textBlock("heading", titleValue, titleEntry));
      return blocks;
    }

    if (TEXT_KEYS.has(key)) {
      if (isObject(value) && value.value != null) {
        blocks.push(textBlock(key, value.value, value));
      } else {
        blocks.push(textBlock(key, value));
      }
      return blocks;
    }



    if (key === "image" || key === "video") {

      blocks.push(mediaBlock(key, value));

      return blocks;

    }



    if (key === "images" || key === "videos") {

      const type = key === "images" ? "image" : "video";

      (Array.isArray(value) ? value : [value]).forEach((item) => {

        blocks.push(mediaBlock(type, item));

      });

      return blocks;

    }



    if (key === "content") {

      blocks.push(...blocksFromContentArray(value));

      return blocks;

    }



    if (key === "action") {

      blocks.push({

        type: "action",

        handler: value,

        label: node.actionLabel || "Run Action"

      });

      return blocks;

    }



    if (typeof value === "string") {

      blocks.push(textBlock("text", value));

    }



    return blocks;

  }



  function blocksFromNode(node) {

    const blocks = [];

    const keys = Array.isArray(node.order)

      ? node.order.filter((key) => key in node)

      : Object.keys(node).filter((key) => !STRUCTURAL_KEYS.has(key) && key !== "order");



    keys.forEach((key) => {

      blocks.push(...emitBlocksForKey(node, key));

    });



    return blocks;

  }



  function getChildPreview(child) {

    if (Array.isArray(child)) {

      return child.length ? `${child.length} elementer` : "Tom liste";

    }



    if (!isObject(child)) {

      return truncate(String(child));

    }



    if (child.text) return truncate(child.text);

    if (child.title) return truncate(child.title);



    const itemCount = child.items ? Object.keys(child.items).length : 0;

    if (itemCount) return `${itemCount} underseksjon${itemCount === 1 ? "" : "er"}`;



    if (child.content && Array.isArray(child.content)) {

      const firstText = child.content.find((entry) => entry?.type === "text" || entry?.type === "heading");

      if (firstText) return truncate(firstText.value || firstText.text || "");

    }



    return "";

  }



  function getChildKind(child) {

    if (Array.isArray(child)) return "leaf";

    if (!isObject(child)) return "leaf";

    if (child.items && Object.keys(child.items).length) return "branch";

    if (child.content && child.content.length) return "branch";

    if (child.text || child.image || child.video || child.images || child.videos) return "branch";

    return "leaf";

  }



  function resolveNavigation(child) {

    if (Array.isArray(child)) {

      return { mode: "final", payload: child };

    }



    if (!isObject(child)) {

      return { mode: "final", payload: [String(child)] };

    }



    if (child.items && Object.keys(child.items).length) {

      return { mode: "level", payload: child };

    }



    const hasContent =

      child.text ||

      child.text2 ||

      child.note ||

      child.image ||

      child.video ||

      child.images ||

      child.videos ||

      (child.content && child.content.length);



    if (hasContent) {

      return { mode: "level", payload: child };

    }



    return { mode: "final", payload: [] };

  }



  function getItemEntries(node) {

    const source = node.items || node.card;

    if (!source || typeof source !== "object" || Array.isArray(source)) return [];



    const entries = Object.entries(source).map(([key, child]) => ({

      key,

      child,

      preview: getChildPreview(child),

      kind: getChildKind(child),

      navigation: resolveNavigation(child)

    }));



    if (Array.isArray(node.itemsOrder)) {

      const rank = new Map(node.itemsOrder.map((key, index) => [key, index]));

      entries.sort((a, b) => {

        const ai = rank.has(a.key) ? rank.get(a.key) : 9999;

        const bi = rank.has(b.key) ? rank.get(b.key) : 9999;

        return ai - bi;

      });

    }



    return entries;

  }



  function parseNode(node) {

    if (Array.isArray(node)) {

      return {

        kind: "array",

        blocks: node.map((value) => textBlock("text", value)).filter(Boolean),

        items: [],

        layout: "stack"

      };

    }



    if (!isObject(node)) {

      return {

        kind: "primitive",

        blocks: [textBlock("text", node)].filter(Boolean),

        items: [],

        layout: "stack"

      };

    }



    const blocks = blocksFromNode(node);



    return {

      kind: getItemEntries(node).length ? "branch" : blocks.length ? "content" : "empty",

      blocks,

      items: getItemEntries(node),

      layout: node.layout || "stack",

      meta: node.meta || null

    };

  }



  window.TreeReader = {

    parseNode,

    getItemEntries,

    resolveNavigation,

    truncate,

    resolveWidth,
    resolveFontSize,
    resolveFontWeight,
    WIDTH_ALIASES,
    FONT_SIZE_ALIASES,
    FONT_WEIGHT_ALIASES

  };

})();


