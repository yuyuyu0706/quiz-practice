export function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function scrollQuizIntoView(quizTopAnchor, quizView) {
  const target = quizTopAnchor ?? quizView;
  if (!target) return;

  if (isMobileViewport()) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function scrollChoiceGroupIntoView(choicesForm) {
  if (!isMobileViewport() || !choicesForm) return;
  choicesForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function createSecondaryActionLayoutController(elements) {
  const { secondaryActionsToggle, suspendMobileSlot, suspendDesktopSlot, suspendToHome } = elements;

  function getSecondaryGroup() {
    return secondaryActionsToggle?.closest('.button-group-secondary');
  }

  function syncLayout() {
    const targetSlot = isMobileViewport() ? suspendMobileSlot : suspendDesktopSlot;
    if (!targetSlot || !suspendToHome || targetSlot.contains(suspendToHome)) return;
    targetSlot.appendChild(suspendToHome);
  }

  function setOpen(isOpen) {
    const secondaryGroup = getSecondaryGroup();
    if (!secondaryActionsToggle || !secondaryGroup) return;
    const shouldOpen = Boolean(isOpen) && isMobileViewport();
    secondaryGroup.classList.toggle('is-open', shouldOpen);
    secondaryActionsToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  }

  function close(options = {}) {
    const { forceDesktopState = false } = options;
    if (!isMobileViewport() && !forceDesktopState) return;
    setOpen(false);
  }

  function handleDocumentClick(event) {
    if (!isMobileViewport()) return;
    const secondaryGroup = getSecondaryGroup();
    if (!secondaryGroup || secondaryGroup.contains(event.target)) return;
    close();
  }

  function handleViewportChange() {
    syncLayout();
    if (!isMobileViewport()) {
      close({ forceDesktopState: true });
    }
  }

  return {
    syncLayout,
    setOpen,
    close,
    handleDocumentClick,
    handleViewportChange,
  };
}
