// Who's behind each Sleeper account: first name and headshot (assets/heads/<photo>.jpg, 320px square, face-centred).
// Keyed by Sleeper user_id, which survives display-name and team-name changes. Accounts not listed here fall back to
// their Sleeper avatar.
export const MEMBERS = {
  '964343481231593472': { first: 'Dan', photo: 'daniyal' },     // dmir9999
  '1004101289912926208': { first: 'Akrm', photo: 'akrm' },      // Akrm
  '1004101328819351552': { first: 'Hamza', photo: 'hamza' },    // HamzaM123
  '1004163936612089856': { first: 'Mo', photo: 'mo' },          // ArabHammerMo
  '1236096188118204416': { first: 'Shahan', photo: 'shahan' },  // NFLShahan
  '1402120808771391488': { first: 'Stefano', photo: 'stefano' },// 2girls1stef
  '1004111276118761472': { first: 'Tarek', photo: 'tarek' },    // ScaryTerrygee
  '1004099157217685504': { first: 'Chubbs', photo: 'chubbs' },  // Amelrezz
  '1004155263252824064': { first: 'Khalil', photo: 'khalil' },  // toolegittoquit365
  '1005154707439980544': { first: 'Jalal', photo: 'jalal' },    // CashMir97
  '1266185245770661888': { first: 'Mustafa', photo: 'mustafa' },// SheckWes7
  '857297655477444608': { first: 'Aadil', photo: 'aadil' },     // Snkalltheway
};

// Guests on the league desk: not in the league, but Dan gave them a personal link. `name` is shown in full (no team),
// `icon` is a picture in assets/ standing in for a headshot. The desk accepts MEMBERS and GUESTS (DESK_PEOPLE); nothing
// else on the site reads GUESTS, so a guest never shows up in rankings, faces or the team picker.
export const GUESTS = {
  'guest-saad': { first: 'Ex Player Saad', icon: 'assets/heads/helmet.svg' }, // Dan's cousin
};
export const DESK_PEOPLE = { ...MEMBERS, ...GUESTS };

// the single-file preview inlines the photos as data URIs on window.__HEADS__
export const photoUrl = (photo) => globalThis.__HEADS__?.[photo] || `assets/heads/${photo}.jpg`;
