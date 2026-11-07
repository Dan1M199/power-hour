// Stable IDs shared by headline reactions and the editor's per-week overrides.
export const storyKeys = (stories, week = 1) => {
  const seen = {};
  return stories.map((st) => {
    if (st.key) return st.key;
    const n = (seen[st.type] = (seen[st.type] || 0) + 1);
    return `w${week}:${st.type}${n > 1 ? `-${n}` : ''}`;
  });
};
