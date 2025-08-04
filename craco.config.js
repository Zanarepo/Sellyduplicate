module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Log rules to debug
      console.log('Webpack Rules:', JSON.stringify(webpackConfig.module.rules, null, 2));

      // Find the rule containing source-map-loader
      webpackConfig.module.rules = webpackConfig.module.rules.map((rule) => {
        if (rule.oneOf) {
          rule.oneOf = rule.oneOf.map((subRule) => {
            if (subRule.loader && subRule.loader.includes('source-map-loader')) {
              return {
                ...subRule,
                exclude: [
                  /node_modules[\\\/]html5-qrcode/,
                  /node_modules[\\\/]@zxing[\\\/]library/,
                ],
              };
            }
            return subRule;
          });
        }
        return rule;
      });

      return webpackConfig;
    },
  },
};