export const fonts = {
  ui: "NType82",
  headline: "NType82",
  mono: "NType82Mono",
  dot: "Ndot57",
  dotCaps: "Ndot57Caps",
  dot55: "Ndot55",
  letterMono: "LetteraMono",
  letterMonoMedium: "LetteraMonoMedium",
  letterMonoLight: "LetteraMonoLight",
  spaceGrotesk: "SpaceGrotesk",
  spaceMono: "SpaceMono",
  inter: "Inter",
};

export const typography = {
  // Main screen titles
  header: {
    fontFamily: fonts.headline,
    fontSize: 35,
    lineHeight: 42,
    letterSpacing: -0.7,
  },

  // Section headings
  subHeader: {
    fontFamily: fonts.ui,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.3,
  },

  // Large display values
  display: {
    fontFamily: fonts.dot,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
  },

  // Normal application text
  body: {
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 22,
  },

  // Smaller body text
  bodySmall: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 19,
  },

  // Descriptions / secondary information
  caption: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
  },

  // Search fields
  search: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
  },

  // Buttons
  button: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 19,
  },

  // Very small labels
  tiny: {
    fontFamily: fonts.dotCaps,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
  },

  // Technical / data
  technical: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
  },

  // Technical numbers
  number: {
    fontFamily: fonts.dot,
    fontSize: 28,
    lineHeight: 34,
  },

  // Small uppercase labels
  label: {
    fontFamily: fonts.dotCaps,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
};
