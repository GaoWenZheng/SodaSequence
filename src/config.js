window.SODA_CONFIG = Object.freeze({
  generatorVersion: 10,

  economy: {
    /*
      每日挑战只在当天第一次完成时奖励。
      实际奖励由 DailyChallenge.scoreBySteps() 在 10~100 间计算。
    */
    dailyRewardMin: 10,
    dailyRewardMax: 100,

    extraBottleCost: 5,
    hintCost: 1,
    customChallengeCost: 1
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
  0xff5c70, // 红
  0x3f82f7, // 蓝
  0x58c95f, // 绿
  0xffd33d, // 黄

  0x985ee8, // 紫
  0xff9638, // 橙
  0x22b8d1, // 青
  0x8b603c, // 棕

  0xee66b7, // 粉
  0x64798f, // 灰蓝
  0xd94b35, // 深橘红
  0x168c72  // 深青绿
  ]
});
