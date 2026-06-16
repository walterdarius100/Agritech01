// Agri-tech public analytics loader.
// Replace placeholder IDs below only after creating the real GA4 / Clarity properties
// for https://agritech509ht.com. This file is intentionally not loaded on admin.html.
window.ANALYTICS_CONFIG = window.ANALYTICS_CONFIG || {
  ga4MeasurementId: 'G-XXXXXXXXXX',
  clarityProjectId: 'XXXXXXXXXX',
  enabled: true
};

(function initPublicAnalytics() {
  var config = window.ANALYTICS_CONFIG || {};
  if (config.enabled === false) return;

  var ga4MeasurementId = String(config.ga4MeasurementId || config.gaMeasurementId || '').trim();
  var clarityProjectId = String(config.clarityProjectId || '').trim();

  if (ga4MeasurementId && !ga4MeasurementId.includes('XXXX')) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga4MeasurementId, { anonymize_ip: true });

    if (!document.querySelector('script[data-agritech-analytics="ga4"]')) {
      var ga4Script = document.createElement('script');
      ga4Script.async = true;
      ga4Script.dataset.agritechAnalytics = 'ga4';
      ga4Script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4MeasurementId);
      document.head.appendChild(ga4Script);
    }
  }

  if (clarityProjectId && !clarityProjectId.includes('XXXX')) {
    if (!document.querySelector('script[data-agritech-analytics="clarity"]')) {
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.dataset.agritechAnalytics='clarity';t.src='https://www.clarity.ms/tag/'+encodeURIComponent(i);
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, 'clarity', 'script', clarityProjectId);
    }
  }
}());
