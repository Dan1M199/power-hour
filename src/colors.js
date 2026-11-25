// The twelve team colours, on their own so the frame (app.js) can colour the league without pulling in the charts.
// Checked with the dataviz palette validator on white: every adjacent pair clears the colour-blind and normal-vision
// separation floors. Three slots sit under 3:1 contrast on white, so every chart that uses them also labels the marks
// directly.
export const TEAM_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
  '#6250d6', '#e34948', '#ad1457', '#7a8b00', '#0097a7', '#a0522d',
];
