// Filter scene pairings based on user's gender identity
export function filterScenePairings(genderIdentity, allPairings) {
  if (!genderIdentity) return allPairings;

  const relevantPairings = [];

  allPairings.forEach(pairing => {
    const value = pairing.value;
    
    // Always show these to everyone
    if (['group', 'gangbang', 'interracial', 'other'].includes(value)) {
      relevantPairings.push(pairing);
      return;
    }

    // Filter based on gender identity
    if (genderIdentity === 'woman') {
      // Show only pairings with women/girls
      if (value.includes('girl') && !value.includes('trans')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'man') {
      // Show only pairings with men/boys
      if (value.includes('boy') && !value.includes('trans') && !value.includes('girl_girl')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'trans_woman') {
      // Show trans female pairings
      if (value.includes('trans_female')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'trans_man') {
      // Show trans male pairings
      if (value.includes('trans_male')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'non_binary') {
      // Show all pairings for non-binary
      relevantPairings.push(pairing);
    }
  });

  return relevantPairings;
}