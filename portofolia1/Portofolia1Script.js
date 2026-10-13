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


/* glow follow */
document.addEventListener("mousemove", e => {
  document.querySelectorAll(".card,.emptyBox").forEach(el => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", (e.clientX - r.left) + "px");
    el.style.setProperty("--y", (e.clientY - r.top) + "px");
  });
});

function loadFinal(list, titleText) {
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
      loadLevel(NodesTree[1][node.key], node.key, "18px");
      categoryPage.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  };

  heroGrid.appendChild(card);
});

cards.forEach(card => {
  const name = card.innerText.trim();

  card.onclick = () => {
    if (NodesTree[1][name]) {
      history = [];
      loadLevel(NodesTree[1][name], name, "24px");
      categoryPage.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    if (name === "Om meg") {
      categoryPage.classList.add("active");
      document.body.style.overflow = "hidden";
      smallGrid.innerHTML = "";
      title.innerText = "Om meg";

      smallGrid.innerHTML = `
        <p style="grid-column:1/-1;opacity:.8">
          Jeg bygger systemer som kombinerer simulering, logikk og struktur.
        </p>
      `;
    }
  };
});

backBtn.onclick = () => {
  history.pop();

  const prev = history.pop();

  if (prev) {
    loadLevel(prev.node, prev.title, prev.fontSize);
  } else {
    categoryPage.classList.remove("active");
    document.body.style.overflow = "auto";

    const trail = document.getElementById("breadcrumbTrail");
    if (trail) {
      trail.innerHTML = "";
      trail.style.display = "none";
    }
  }
};


































































































