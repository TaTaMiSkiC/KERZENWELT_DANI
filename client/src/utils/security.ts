// Security utilities to prevent access to developer tools for non-admin users

export function initializeSecurity(isAdmin: boolean = false) {
  // Only apply restrictions if user is not admin
  if (isAdmin) {
    console.log("Admin user detected - developer tools allowed");
    return;
  }

  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+Shift+C
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    
    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    
    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return false;
    }
    
    // Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }

    // Ctrl+S (Save page)
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      return false;
    }
  });

  // Detect if DevTools is open
  setInterval(() => {
    if (window.outerHeight - window.innerHeight > 160) {
      window.location.href = '/';
    }
  }, 1000);

  // Disable text selection
  document.onselectstart = () => false;
  document.ondragstart = () => false;

  // Clear console periodically
  setInterval(() => {
    console.clear();
  }, 1000);

  // Override console methods
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};

  console.log("Security measures activated for non-admin user");
}