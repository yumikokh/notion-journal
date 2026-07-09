// app.json をベースに、APP_VARIANT でバンドルID・アプリ名を variant ごとに出し分ける。
// EAS クラウドビルドでは eas.json の env で APP_VARIANT が渡る。
// ローカルビルドでは package.json の *:dev スクリプト経由で渡す。
// APP_VARIANT 未指定時は production 扱い（サフィックスなし）。
const VARIANTS = {
  development: { suffix: ".dev", label: " (Dev)" },
  preview: { suffix: ".preview", label: " (Preview)" },
  production: { suffix: "", label: "" },
};

export default ({ config }) => {
  const variant = process.env.APP_VARIANT ?? "production";
  const { suffix, label } = VARIANTS[variant] ?? VARIANTS.production;

  // app.json の ios.bundleIdentifier をベース値として流用し、二重管理を避ける。
  const baseBundleId =
    config.ios?.bundleIdentifier ?? "com.yumikokh.notion-journal";
  const bundleId = `${baseBundleId}${suffix}`;

  // Android の Application ID はハイフンを許容しない（iOS の bundleIdentifier は許容する）。
  const androidPackage = bundleId.replace(/-/g, "_");

  return {
    ...config,
    name: `${config.name}${label}`,
    ios: {
      ...config.ios,
      bundleIdentifier: bundleId,
    },
    android: {
      ...config.android,
      package: androidPackage,
    },
  };
};
