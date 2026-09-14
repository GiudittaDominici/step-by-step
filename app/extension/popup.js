document.addEventListener('DOMContentLoaded', () => {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file'))) {
      dot.classList.add('active');
      statusText.textContent = 'Estensione attiva su questa pagina';
    } else {
      statusText.textContent = 'Apri una pagina web per usare l\'assistente';
    }
  });

  document.getElementById('open-demo').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('../demo/form.html')
    });
  });
});
