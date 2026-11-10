type LoadingFlag = "weakLoading" | "crossLoading" | "lowCommunality";

export function getLoadingFlags(loadings: number[], communality: number) {
  let primaryIndex = 0;
  let primary = Math.abs(loadings[0]);
  let second = 0;
  for (let i = 1; i < loadings.length; i++) {
    const magnitude = Math.abs(loadings[i]);
    if (magnitude > primary) {
      second = primary;
      primary = magnitude;
      primaryIndex = i;
    } else if (magnitude > second) {
      second = magnitude;
    }
  }

  const flags: LoadingFlag[] = [];
  if (primary < 0.4) flags.push("weakLoading");
  // Absorb subtraction roundoff for values exactly at the 0.20 boundary.
  if (second >= 0.3 && primary - second < 0.2 - Number.EPSILON) flags.push("crossLoading");
  if (communality < 0.3) flags.push("lowCommunality");
  return { primaryIndex, flags };
}
