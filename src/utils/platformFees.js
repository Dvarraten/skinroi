// Returns the decimal fee fraction for a given platform (e.g. 0.02 = 2%).
// Pass customFee (0–100 percentage) to override for the "other" platform.
export const getPlatformFee = (platform, customFee) => {
  if (platform === 'other' && customFee != null) {
    return parseFloat(customFee) / 100 || 0;
  }
  switch (platform) {
    case 'buff163':
      return 0.015;
    case 'csfloat':
      return 0.02;
    case 'csmoney':
    case 'skinswap':
    case 'dmarket':
    case 'tradeit':
      return 0.05;
    case 'facebook':
      return 0;
    case 'youpin':
      return 0.005;
    case 'skins':
      return 0.01;
    default:
      return 0;
  }
};