const url = require('url');
const path = require('path');
const fs = require('fs');

// copied from 'react-dev-utils/WebpackDevServerUtils'
function mayProxy(pathname) {
  const maybePublicPath = path.resolve("public", pathname.slice(1));
  return !fs.existsSync(maybePublicPath);
}

/**
 * For 303's we need to rewrite the location to have host of `localhost`.
 */
function rewriteRedirect(proxyRes, req) {
  if (proxyRes.headers['location'] && proxyRes.statusCode === 303) {
    var u = url.parse(proxyRes.headers['location']);
    u.host = req.headers['host'];
    proxyRes.headers['location'] = u.format();
  }
}

/**
 * In Databricks, we send a cookie with a CSRF token and set the path of the cookie as "/mlflow".
 * We need to rewrite the path to "/" for the dev index.html/bundle.js to use the CSRF token.
 */
function rewriteCookies(proxyRes) {
  if (proxyRes.headers['set-cookie'] !== undefined) {
    const newCookies = [];
    proxyRes.headers['set-cookie'].forEach((c) => {
      newCookies.push(c.replace('Path=/mlflow', 'Path=/'))
    });
    proxyRes.headers['set-cookie'] = newCookies;
  }
}

module.exports = {
  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      const proxyTarget = process.env.MLFLOW_PROXY;
      if (proxyTarget) {
        config.hot = true;
        config.https = true;
        config.proxy = [{
          context: function(pathname) {
            return mayProxy(pathname);
          },
          target: proxyTarget,
          secure: false,
          changeOrigin: true,
          ws: true,
          xfwd: true,
          onProxyRes: (proxyRes, req) => {
            rewriteRedirect(proxyRes, req);
            rewriteCookies(proxyRes);
          },
        }];
      }
      return config;
    };
  }
}
