const INTERACTIVE_TAGS = ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"];

// Delete/Backspace on a focused control must act on that control, not on the selected 3D item
export function shouldHandleSceneKey(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return true;
  if (element.isContentEditable) return false;
  return !INTERACTIVE_TAGS.includes(element.tagName);
}
