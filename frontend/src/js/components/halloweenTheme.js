export function initHalloweenTheme() {
  const isHalloween = true; // Set to false to revert to normal theme

  if (!isHalloween) return;

  document.body.classList.add('theme-halloween');

  // Spawn ghosts and bats periodically
  setInterval(() => {
    spawnEntity('ghost-anim', '👻');
  }, 4000);

  setInterval(() => {
    spawnEntity('bat-anim', '🦇');
  }, 6000);

  // Spawn a vampire or zombie occasionally
  setInterval(() => {
    spawnEntity('ghost-anim', '🧛');
  }, 12000);

  setInterval(() => {
    spawnEntity('bat-anim', '🧟');
  }, 18000);
}

function spawnEntity(className, emoji) {
  const entity = document.createElement('div');
  entity.className = className;
  entity.innerText = emoji;
  
  // Randomize start position
  if (className === 'ghost-anim') {
    entity.style.left = Math.random() * 90 + 'vw';
    entity.style.animationDuration = (6 + Math.random() * 4) + 's';
  } else if (className === 'bat-anim') {
    entity.style.top = Math.random() * 80 + 'vh';
    entity.style.animationDuration = (8 + Math.random() * 6) + 's';
  }

  document.body.appendChild(entity);

  // Remove entity after animation finishes
  setTimeout(() => {
    entity.remove();
  }, 15000);
}

// Add a toggle button for the theme
export function renderThemeToggle() {
  const toggleBtn = document.createElement('button');
  toggleBtn.innerHTML = '🎃';
  toggleBtn.className = 'fixed bottom-24 right-6 w-14 h-14 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-orange-500 transition-colors z-[10000] text-2xl';
  toggleBtn.title = "Toggle Halloween Theme";
  
  toggleBtn.onclick = () => {
    document.body.classList.toggle('theme-halloween');
    // If we wanted to stop/start animations we could, 
    // but just toggling the theme is enough for the visual colors.
  };

  document.body.appendChild(toggleBtn);
}
