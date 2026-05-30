function focusPlayerArea(): void {
  const player = document.querySelector<HTMLElement>('video, #movie_player, [role="main"]');
  player?.focus();
}

function setupTvKeyHints(): void {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) {
      console.info('[youtube-tv-lite] TV key:', event.key);
    }
  });
}

focusPlayerArea();
setupTvKeyHints();
