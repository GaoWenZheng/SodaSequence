window.SODA_CONFIG = Object.freeze({
  generatorVersion: 10,

  economy: {
    /*
      每日挑战只在当天第一次完成时奖励。
      实际奖励由 DailyChallenge.scoreBySteps() 在 10~100 间计算。
    */
    dailyRewardMin: 10,
    dailyRewardMax: 100,

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
    /* 原来的 12 色：主线完全不变 */
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
    0x32aa91,

    /*
      每日第 2 / 3 关扩展色。
      刻意利用不同色相 + 明度来拉开差异。
    */
    0x2457d6, // 深皇家蓝
    0x7d3fc7, // 深紫
    0xd6a512, // 芥末黄
    0x188a43, // 深绿
    0xc75400, // 烧橙
    0x72c8f4, // 浅天蓝
    0xc985dc, // 浅紫
    0x5ad9bd, // 薄荷
    0xf3a0a8, // 浅珊瑚
    0x455767, // 深灰蓝
    0xb7d84b, // 黄绿

    /*
      第 4 关以及未来扩展预留色。
      目前第 4 关使用到前 29 色；总表预留到 31 色。
    */
    0xe83e8c, // 洋红
    0x006d77, // 深青
    0xf4b942, // 琥珀
    0x386641, // 森林绿
    0xb23a48, // 酒红
    0x5a6fbf, // 靛蓝
    0xf26a2e, // 鲜橙
    0x6d28d9  // 深紫
  ]
});
