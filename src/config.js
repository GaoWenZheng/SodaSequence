window.SODA_CONFIG = Object.freeze({
  generatorVersion: 10,

  economy: {
    dailyReward: 10,
    extraBottleCost: 10,
    hintCost: 5,
    customChallengeCost: 5
  },

  board: {
    minHeight: 600,

    // 大幅增加顶部空间，倾倒时瓶子不会被裁掉。
    topSafeSpace: 215,

    bottomPadding: 54,
    desktopGap: 76,
    mobileGap: 60,

    desktopScale: .82,
    mobileScale: .72
  },

  bottle: {
    capacity: 4,
    mouthY: -84,

    // 4 格满时仍保留瓶颈空气，不把液体灌到瓶口。
    capacityTop: -56,
    innerBottom: 78
  },

  colors: [
    0xff6678,
    0x4f8ff7,
    0x52ce7c,
    0xffd451,
    0x9c72ed,
    0xff9d48,
    0x39c6c8,
    0x9b6a4a,
    0xf06eaf,
    0x658295,
    0xef765d,
    0x32aa91
  ]
});
