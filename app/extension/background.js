// Service worker minimal — richiesto da Manifest V3
chrome.runtime.onInstalled.addListener(() => {
  console.log('Step by Step installato.');
});
