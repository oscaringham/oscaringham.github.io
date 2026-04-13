const items = Array.from(document.querySelectorAll('.project-item'));
const pointer = document.getElementById('timelinePointer');
const list = document.getElementById('projectsList');
const panel = document.getElementById('casePanel');
const panelContent = document.getElementById('panelContent');
const panelBackButton = document.getElementById('panelBackButton');
const desktopQuery = window.matchMedia('(min-width: 1100px)');

let activeIndex = 0;
let ticking = false;
let isDesktopMode = desktopQuery.matches;
let flipCleanupTimer = 0;
let flipAnimating = false;

function setActive(index) {
  if (index === activeIndex) {
    return;
  }

  if (isDesktopMode) {
    applyActiveState(index);
    return;
  }

  animateListReflow(index, () => {
    applyActiveState(index);
  });
}

function applyActiveState(index) {
  items[activeIndex]?.classList.remove('is-active');
  items[index]?.classList.add('is-active');
  activeIndex = index;
  updatePointer();
  if (isDesktopMode) {
    renderPanel(index);
  }
}

function animateListReflow(anchorIndex, changeFn) {
  flipAnimating = true;
  list?.classList.add('is-reflowing');
  const firstRects = items.map((item) => item.getBoundingClientRect());
  const anchorItem = items[anchorIndex];
  const firstAnchorTop = anchorItem?.getBoundingClientRect().top ?? 0;

  changeFn();

  if (list && anchorItem) {
    const lastAnchorTop = anchorItem.getBoundingClientRect().top;
    const anchorDelta = lastAnchorTop - firstAnchorTop;
    if (Math.abs(anchorDelta) > 0.1) {
      const previousScrollBehavior = list.style.scrollBehavior;
      list.style.scrollBehavior = 'auto';
      list.scrollTop += anchorDelta;
      list.style.scrollBehavior = previousScrollBehavior;
    }
  }

  const lastRects = items.map((item) => item.getBoundingClientRect());

  items.forEach((item, i) => {
    const deltaY = firstRects[i].top - lastRects[i].top;
    if (Math.abs(deltaY) < 0.5) {
      return;
    }
    item.style.transition = 'none';
    item.style.transform = `translateY(${deltaY}px)`;
    item.style.willChange = 'transform';
  });

  requestAnimationFrame(() => {
    items.forEach((item) => {
      if (!item.style.transform) {
        return;
      }
      item.style.transition = 'transform 180ms cubic-bezier(0.15, 0.9, 0.25, 1)';
      item.style.transform = '';
    });
  });

  window.clearTimeout(flipCleanupTimer);
  flipCleanupTimer = window.setTimeout(() => {
    items.forEach((item) => {
      item.style.transition = '';
      item.style.transform = '';
      item.style.willChange = '';
    });
    list?.classList.remove('is-reflowing');
    flipAnimating = false;
  }, 220);
}

function updatePointer() {
  if (!pointer || !list || items.length === 0) {
    return;
  }

  const selectedItem = items[activeIndex];
  if (!selectedItem) {
    return;
  }

  const listRect = list.getBoundingClientRect();
  const styles = window.getComputedStyle(list);
  const snapOffset = parseFloat(styles.scrollPaddingTop) || parseFloat(styles.paddingTop) || 0;
  const pointerTop = listRect.top + snapOffset + selectedItem.offsetHeight * 0.5;
  const clampedTop = Math.max(16, Math.min(window.innerHeight - 16, pointerTop));
  pointer.style.top = `${clampedTop}px`;
}

function getClosestToTopIndex() {
  if (!list) {
    return 0;
  }

  const listRect = list.getBoundingClientRect();
  const styles = window.getComputedStyle(list);
  const snapOffset = parseFloat(styles.scrollPaddingTop) || parseFloat(styles.paddingTop) || 0;
  const snapLine = listRect.top + snapOffset;
  let closestIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  items.forEach((item, index) => {
    const distance = Math.abs(item.getBoundingClientRect().top - snapLine);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function scrollItemToSnap(index, behavior = 'smooth') {
  if (!list) {
    return;
  }

  const targetItem = items[index];
  if (!targetItem) {
    return;
  }

  const styles = window.getComputedStyle(list);
  const snapOffset = parseFloat(styles.scrollPaddingTop) || parseFloat(styles.paddingTop) || 0;
  const targetTop = Math.max(0, targetItem.offsetTop - snapOffset);
  list.scrollTo({ top: targetTop, behavior });
}

function onScroll() {
  if (ticking || flipAnimating) {
    return;
  }

  ticking = true;
  requestAnimationFrame(() => {
    const nextIndex = getClosestToTopIndex();
    setActive(nextIndex);
    ticking = false;
  });
}

function renderPanel(index) {
  const panelId = items[index]?.dataset.panelId;
  const template = panelId ? document.getElementById(panelId) : null;
  if (!panel || !panelContent || !(template instanceof HTMLTemplateElement)) {
    return;
  }

  panelContent.replaceChildren(template.content.cloneNode(true));
}

function openPanel(index) {
  if (!panel) {
    return;
  }

  renderPanel(index);
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
}

function closePanel() {
  if (!panel || isDesktopMode) {
    return;
  }

  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
}

function syncLayoutMode() {
  if (!panel) {
    return;
  }

  isDesktopMode = desktopQuery.matches;

  if (isDesktopMode) {
    panel.classList.add('is-pinned');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'false');
    renderPanel(activeIndex);
    return;
  }

  panel.classList.remove('is-pinned');
  closePanel();
}

function ensureMobileCtas() {
  items.forEach((item, index) => {
    if (item.querySelector('.project-cta')) {
      return;
    }

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'project-cta';
    cta.innerHTML = '<span class="project-cta-label">Find out more</span><span class="project-cta-icon" aria-hidden="true">&gt;</span>';
    cta.addEventListener('click', (event) => {
      event.stopPropagation();
      setActive(index);
      if (!isDesktopMode) {
        openPanel(index);
      }
    });
    item.appendChild(cta);
  });
}

function enableDesktopItemClicks() {
  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      if (!isDesktopMode) {
        return;
      }
      setActive(index);
      scrollItemToSnap(index);
    });
  });
}

panelBackButton?.addEventListener('click', closePanel);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closePanel();
  }
});

items[0]?.classList.add('is-active');
ensureMobileCtas();
enableDesktopItemClicks();
renderPanel(0);
updatePointer();
syncLayoutMode();

list?.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => {
  updatePointer();
  syncLayoutMode();
});
desktopQuery.addEventListener('change', syncLayoutMode);
