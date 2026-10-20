const clothOffsetY = 100; 


const heroGrid = document.getElementById("heroGrid");


const NodesTree = window.TREE;


const categoryPage = document.getElementById("categoryPage");
const title = document.getElementById("title");
const backBtn = document.getElementById("backBtn");
const smallGrid = document.querySelector(".smallGrid");
const cards = document.querySelectorAll(".card");

// <button class="squareBtn">+</button>





let history = [];
let mainScrollY = 0;
let heroScrollLocked = true;

const scrollUnlockBtn = document.getElementById("scrollUnlockBtn");

function unlockPageScroll() {
  if (!heroScrollLocked) {
    return;
  }

  heroScrollLocked = false;
  document.body.classList.remove("heroGate");
  window.dispatchEvent(new Event("resize"));
}

function restoreMainScrollAfterOverlay() {
  document.body.classList.remove("mainScrollLocked");
  document.body.style.top = "";

  if (heroScrollLocked) {
    document.body.classList.add("heroGate");
    window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, mainScrollY);
  }
}

scrollUnlockBtn?.addEventListener("click", () => {
  unlockPageScroll();

  const nextSection = document.querySelector(".hero + .section");
  if (nextSection) {
    nextSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

function lockMainScroll() {
  mainScrollY = window.scrollY || 0;
  document.body.classList.add("mainScrollLocked");
  document.body.style.top = `-${mainScrollY}px`;
  categoryPage.scrollTop = 0;
}

function showCategoryPage() {
  categoryPage.classList.add("active");
}

function closeCategoryPage() {
  categoryPage.classList.remove("active");
  categoryPage.scrollTop = 0;

  restoreMainScrollAfterOverlay();

  smallGrid.innerHTML = "";
  smallGrid.style.position = "";
  title.innerText = "Kategori";

  const trail = document.getElementById("breadcrumbTrail");
  if (trail) {
    trail.innerHTML = "";
    trail.style.display = "none";
  }

  history = [];
  window.dispatchEvent(new Event("resize"));
}

/* glow follow */
document.addEventListener("mousemove", e => {
  document.querySelectorAll(".card,.emptyBox").forEach(el => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", (e.clientX - r.left) + "px");
    el.style.setProperty("--y", (e.clientY - r.top) + "px");
  });
});

function loadFinal(list, titleText) {
  window.MC_CURSOR_SYSTEM?.onViewChange?.();

  categoryPage.scrollTop = 0;
  smallGrid.innerHTML = "";
  title.innerText = titleText;

  list.forEach(t => {
    const box = document.createElement("div");
    box.className = "emptyBox";
    box.innerText = t;
    smallGrid.appendChild(box);
  });
}


NodesTree[0].forEach(node => {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${node.img}">
    <h3>${node.key}</h3>
  `;

  card.onclick = () => {
    if (NodesTree[1][node.key]) {
      history = [];
      lockMainScroll();
      loadLevel(NodesTree[1][node.key], node.key, "18px");
      showCategoryPage();
    }
  };

  heroGrid.appendChild(card);
});

cards.forEach(card => {
  const name = card.innerText.trim();

  card.onclick = () => {
    if (NodesTree[1][name]) {
      history = [];
      lockMainScroll();
      loadLevel(NodesTree[1][name], name, "24px");
      showCategoryPage();
    }

    if (name === "Om meg") {
      history = [];
      lockMainScroll();
      window.MC_CURSOR_SYSTEM?.onViewChange?.();
      smallGrid.innerHTML = "";
      title.innerText = "Om meg";

      smallGrid.innerHTML = `
        <p style="grid-column:1/-1;opacity:.8">
          Jeg bygger systemer som kombinerer simulering, logikk og struktur.
        </p>
      `;
      showCategoryPage();
    }
  };
});

backBtn.onclick = () => {
  history.pop();

  const prev = history.pop();

  if (prev) {
    loadLevel(prev.node, prev.title, prev.fontSize);
  } else {
    window.MC_CURSOR_SYSTEM?.onViewChange?.();
    closeCategoryPage();
  }
};


































































































