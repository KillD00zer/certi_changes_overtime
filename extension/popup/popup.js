/**
 * Popup Script for Google Earth Survey Extension
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusName = document.getElementById('status-name');
  const statusDetails = document.getElementById('status-details');
  const btnOpenSidepanel = document.getElementById('btn-open-sidepanel');
  const btnOpenEarth = document.getElementById('btn-open-earth');
  const btnReset = document.getElementById('btn-reset');

  // Check storage for active parcel
  chrome.storage.local.get(['currentParcel', 'capturedShots'], (res) => {
    if (res.currentParcel) {
      const p = res.currentParcel;
      const count = res.capturedShots ? res.capturedShots.length : 0;
      statusName.textContent = p.applicantName || 'معاملة مسجلة';
      statusDetails.textContent = `المساحة: ${p.calculatedAreaM2.toFixed(1)} م² | المركز: ${p.centerCity || '---'} | اللقطات: ${count}`;
      btnReset.style.display = 'block';
    } else {
      statusName.textContent = 'لا توجد معاملة نشطة';
      statusDetails.textContent = 'افتح اللوحة الجانبية لتحميل ملف مساحي جديد';
      btnReset.style.display = 'none';
    }
  });

  // Open SidePanel
  btnOpenSidepanel.addEventListener('click', async () => {
    try {
      const windowInfo = await chrome.windows.getCurrent();
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: windowInfo.id });
      }
      window.close();
    } catch (e) {
      console.warn('Could not open sidepanel programmatically:', e);
      // Fallback: instruct user to click extension icon or open side panel from browser toolbar
      alert('يمكنك فتح اللوحة الجانبية (Side Panel) بالضغط على أيقونة اللوحة في شريط المتصفح العلوي بجانب العنوان.');
    }
  });

  // Open Google Earth Web
  btnOpenEarth.addEventListener('click', () => {
    chrome.storage.local.get(['currentParcel'], (res) => {
      const url = (res.currentParcel && res.currentParcel.earthUrl)
        ? res.currentParcel.earthUrl
        : 'https://earth.google.com/web';
      chrome.tabs.create({ url: url });
      window.close();
    });
  });

  // Reset Data
  btnReset.addEventListener('click', () => {
    if (confirm('هل أنت متأكد من رغبتك في مسح بيانات المعاملة الحالية واللقطات المحفوظة لبدء طلب جديد؟')) {
      chrome.storage.local.remove(['currentParcel', 'capturedShots'], () => {
        statusName.textContent = 'تم مسح البيانات بنجاح';
        statusDetails.textContent = 'يمكنك الآن تحميل معاملة جديدة';
        btnReset.style.display = 'none';
      });
    }
  });
});
