import { supabase } from "./supabase.js";


// =====================================================
// 基础变量
// =====================================================

let accessCode = "";

let portalData = null;


// =====================================================
// DOM
// =====================================================

const loginPanel =
  document.querySelector("#loginPanel");

const appPanel =
  document.querySelector("#appPanel");

const loginForm =
  document.querySelector("#loginForm");

const accessCodeInput =
  document.querySelector("#accessCode");

const loginMessage =
  document.querySelector("#loginMessage");

const logoutBtn =
  document.querySelector("#logoutBtn");
// =====================================================
// 兑换确认弹窗
// =====================================================

const redeemModal =
  document.querySelector(
    "#redeemModal"
  );

const redeemModalImage =
  document.querySelector(
    "#redeemModalImage"
  );

const redeemModalPlaceholder =
  document.querySelector(
    "#redeemModalPlaceholder"
  );

const redeemModalTitle =
  document.querySelector(
    "#redeemModalTitle"
  );

const redeemModalDescription =
  document.querySelector(
    "#redeemModalDescription"
  );

const redeemCurrentPoints =
  document.querySelector(
    "#redeemCurrentPoints"
  );

const redeemCost =
  document.querySelector(
    "#redeemCost"
  );

const redeemRemainingPoints =
  document.querySelector(
    "#redeemRemainingPoints"
  );

const redeemModalMessage =
  document.querySelector(
    "#redeemModalMessage"
  );

const confirmRedeemModal =
  document.querySelector(
    "#confirmRedeemModal"
  );

const cancelRedeemModal =
  document.querySelector(
    "#cancelRedeemModal"
  );

const closeRedeemModalBtn =
  document.querySelector(
    "#closeRedeemModal"
  );

let selectedReward = null;

let isRedeeming = false;


// =====================================================
// 页面初始化
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    // 每次打开学生端默认显示登录页
    loginPanel?.classList.remove(
      "hidden"
    );

    appPanel?.classList.add(
      "hidden"
    );

  }
);


// =====================================================
// 登录
// =====================================================

loginForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const code =
      accessCodeInput.value.trim();


    if (!code) {

      showLoginMessage(
        "请输入学生PIN。"
      );

      return;

    }


    accessCode = code;


    showLoginMessage(
      "正在登录……"
    );


    const success =
      await loadStudentPortal();


    if (!success) {

      accessCode = "";

    }

  }
);


// =====================================================
// 登出
// =====================================================

logoutBtn?.addEventListener(
  "click",
  () => {

    sessionStorage.removeItem(
      "student_access_code"
    );

    accessCode = "";

    portalData = null;

    appPanel.classList.add(
      "hidden"
    );

    loginPanel.classList.remove(
      "hidden"
    );

    accessCodeInput.value = "";

  }
);


// =====================================================
// 加载学生全部数据
// =====================================================

async function loadStudentPortal() {

  try {

    const { data, error } =
      await supabase.rpc(
        "student_portal_v2",
        {
          p_access_code:
            accessCode
        }
      );


    if (error) {
      throw error;
    }


    if (
      !data ||
      !data.student
    ) {

      showLoginMessage(
        "访问码错误或学生账号已停用。"
      );

      return false;

    }


    portalData = data;
    sessionStorage.setItem(
  "student_access_code",
  accessCode
);


    // 登录成功

    loginPanel.classList.add(
      "hidden"
    );

    appPanel.classList.remove(
      "hidden"
    );


    renderAll();


    return true;


  } catch (error) {

    console.error(
      "student_portal error:",
      error
    );

    showLoginMessage(
      `加载失败：${error.message}`
    );

    return false;

  }

}


// =====================================================
// 总渲染
// =====================================================

function renderAll() {

  renderStudent();

  renderNextReward();

  renderLeaderboard();

  renderExchangeHistory();

  renderPointRecords();

  renderRewards();

  renderMyRedemptions();

}


// =====================================================
// 学生信息
// =====================================================

function renderStudent() {

  const student =
    portalData.student;


  document.querySelector(
    "#studentName"
  ).textContent =
    student.name;


  document.querySelector(
    "#studentClass"
  ).textContent =
    `${student.class_name} · ${student.student_number}号`;


  document.querySelector(
    "#currentPoints"
  ).textContent =
    formatPoints(
      student.current_points
    );


  document.querySelector(
    "#dailyAveragePoints"
  ).textContent =
    formatPoints(
      student.daily_average_points
    );

}


// =====================================================
// 下一个奖品
// =====================================================

function renderNextReward() {

  const container =
    document.querySelector(
      "#nextRewardContent"
    );


  const points =
    Number(
      portalData.student.current_points
    );


  const rewards =
  [...(portalData.rewards ?? [])]
    .sort(
      (a, b) =>
        Number(a.cost) -
        Number(b.cost)
    );


  if (!rewards.length) {

    container.innerHTML = `
      <p class="muted">
        目前还没有可兑换的奖品。
      </p>
    `;

    return;

  }


  // 找到第一个买不起的奖品

  const nextReward =
    rewards.find(
      reward =>
        Number(reward.cost) > points
    );


  // 已经可以买最贵的奖品

  if (!nextReward) {

    const mostExpensive =
      rewards[rewards.length - 1];

    container.innerHTML = `

      <div class="next-reward-complete">

        <strong>
          🎉 太棒了！
        </strong>

        <p>
          你已经可以兑换目前货架上的所有奖品！
        </p>

        <small>
          最高奖品：
          ${escapeHtml(
            mostExpensive.name
          )}
          ·
          ${formatPoints(
            mostExpensive.cost
          )} 分
        </small>

      </div>

    `;

    return;

  }


  const cost =
    Number(nextReward.cost);


  const difference =
    Math.max(
      0,
      cost - points
    );


  // 找这个奖品之前一个档位

  const previousReward =
    [...rewards]
      .reverse()
      .find(
        reward =>
          Number(reward.cost) <= points
      );


  const previousCost =
    previousReward
      ? Number(previousReward.cost)
      : 0;


  const range =
    Math.max(
      1,
      cost - previousCost
    );


  const progress =
    Math.min(
      100,
      Math.max(
        0,
        ((points - previousCost) / range)
        * 100
      )
    );


  container.innerHTML = `

    <div class="next-reward-info">

      <div>

        <strong>
          ${escapeHtml(
            nextReward.name
          )}
        </strong>

        <p>
          还差
          <b>
            ${formatPoints(difference)}
          </b>
          分就可以兑换
        </p>

      </div>

      <span class="next-reward-cost">
        ${formatPoints(cost)} 分
      </span>

    </div>


    <div class="progress-track">

      <div
        class="progress-fill"
        style="width:${progress}%"
      ></div>

    </div>


    <div class="next-reward-progress-text">

      当前
      ${formatPoints(points)}
      /
      ${formatPoints(cost)}
      分

    </div>

  `;

}


// =====================================================
// 排行榜
// =====================================================

function renderLeaderboard() {

  const container =
    document.querySelector(
      "#leaderboardList"
    );


  const list =
    portalData.leaderboard ?? [];


  if (!list.length) {

    container.innerHTML = `
      <p class="muted">
        暂无排行榜数据。
      </p>
    `;

    return;

  }


  container.innerHTML =
    list.map(item => `

      <div class="leaderboard-row">

        <span class="leaderboard-rank">
          ${getRankIcon(item.rank)}
        </span>

        <span class="leaderboard-name">
          第 ${item.rank} 名
        </span>

        <strong>
          ${formatPoints(
            item.current_points
          )}
        </strong>

      </div>

    `).join("");

}


// =====================================================
// 班级兑换动态
// =====================================================

function renderExchangeHistory() {

  const container =
    document.querySelector(
      "#exchangeHistory"
    );


  const list =
    portalData.exchange_history ?? [];


  if (!list.length) {

    container.innerHTML = `
      <p class="muted">
        暂无兑换记录。
      </p>
    `;

    return;

  }


  container.innerHTML = `

    <div class="exchange-scroll">

      ${list.map(item => `

        <div class="exchange-row">

          <span>
            ${escapeHtml(
              item.student_name
            )}
          </span>

          <span>
            使用
            <b>
              ${formatPoints(item.cost)}
            </b>
            积分
          </span>

          <span>
            兑换了
            <b>
              ${escapeHtml(
                item.reward_name
              )}
            </b>
          </span>

        </div>

      `).join("")}

    </div>

  `;

}


// =====================================================
// 积分明细
// =====================================================

function renderPointRecords() {

  const container =
    document.querySelector(
      "#pointRecords"
    );


  const records =
    portalData.records ?? [];


  if (!records.length) {

    container.innerHTML = `
      <p class="muted">
        暂无积分记录。
      </p>
    `;

    return;

  }


  container.innerHTML =
    records.map(record => `

      <div class="point-record-row">

        <div>

          <strong>
            ${escapeHtml(
              record.description ??
              getCategoryName(
                record.category
              )
            )}
          </strong>

          <small>
            ${record.record_date}
          </small>

        </div>

        <strong class="${Number(record.points) < 0 ? "point-negative" : "point-positive"}">
          ${formatSignedPoints(
            record.points
          )}
        </strong>

      </div>

    `).join("");

}


// =====================================================
// 奖品货架
// =====================================================

function renderRewards() {

  const container =
    document.querySelector(
      "#rewardShelf"
    );


  const rewards =
    portalData.rewards ?? [];


  if (!rewards.length) {

    container.innerHTML = `
      <p class="muted">
        暂无可兑换奖品。
      </p>
    `;

    return;

  }


  const points =
    Number(
      portalData.student.current_points
    );


  container.innerHTML =
    rewards.map((reward, index) => {

      const cost =
        Number(reward.cost);

      const canRedeem =
        points >= cost;

      const description = String(
        reward.description ?? ""
      )
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        .trim();

      const descriptionId =
        `reward-description-${index}`;


      return `

        <div class="reward-card">

          <div class="reward-image-box">

            ${
              reward.image_url

                ? `

                  <img
                    src="${escapeHtml(
                      reward.image_url
                    )}"
                    alt="${escapeHtml(
                      reward.name
                    )}"
                  >

                `

                : `

                  <div
                    class="reward-placeholder"
                  >
                    🎁
                  </div>

                `
            }

          </div>


          <div class="reward-card-body">

            <h4>
              ${escapeHtml(
                reward.name
              )}
            </h4>


            <p
              id="${descriptionId}"
              class="reward-description"
            >${escapeHtml(description)}</p>

            ${
              description
                ? `
                  <button
                    class="reward-description-toggle"
                    type="button"
                    data-description-toggle
                    aria-expanded="false"
                    aria-controls="${descriptionId}"
                  >
                    展开查看
                  </button>
                `
                : ""
            }


            <div class="reward-card-bottom">

              <strong>
                ${formatPoints(cost)}
                分
              </strong>


              <button
                class="primary-btn small"
                data-redeem="${reward.id}"
                ${canRedeem ? "" : "disabled"}
              >

                ${
                  canRedeem
                    ? "申请兑换"
                    : `还差 ${formatPoints(
                        cost - points
                      )} 分`
                }

              </button>

            </div>

          </div>

        </div>

      `;

    }).join("");


  // 绑定奖品描述展开按钮

  container
    .querySelectorAll(
      "[data-description-toggle]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const description =
            document.getElementById(
              button.getAttribute(
                "aria-controls"
              )
            );

          if (!description) return;

          const expanded =
            description.classList.toggle(
              "expanded"
            );

          button.setAttribute(
            "aria-expanded",
            String(expanded)
          );

          button.textContent =
            expanded
              ? "收起描述"
              : "展开查看";

        }
      );

    });


  // 绑定兑换按钮

  container
    .querySelectorAll(
      "[data-redeem]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const rewardId =
            Number(
              button.dataset.redeem
           );

          const reward =
            portalData.rewards.find(
              item =>
                item.id === rewardId
            );

           if (!reward) return;

           openRedeemModal(
             reward
           );

         }
       );

    });

}


// =====================================================
// 我的兑换
// =====================================================

function renderMyRedemptions() {

  const container =
    document.querySelector(
      "#myRedemptions"
    );


  const list =
    portalData.my_redemptions ?? [];


  if (!list.length) {

    container.innerHTML = `
      <p class="muted">
        还没有兑换申请。
      </p>
    `;

    return;

  }


  container.innerHTML =
    list.map(item => `

      <div class="redemption-row">

        <div>

          <strong>
            ${escapeHtml(
              item.reward_name
            )}
          </strong>

          <small>
            ${formatPoints(
              item.cost
            )} 分 ·
            ${formatRedemptionStatus(
              item.status
            )}
          </small>

        </div>

        <span>
          ${formatDateTime(
            item.requested_at
          )}
        </span>

      </div>

    `).join("");

}


// =====================================================
// 申请兑换
// =====================================================

// =====================================================
// 确认兑换
// =====================================================

async function requestReward() {

  if (!selectedReward) {
    return;
  }


  if (isRedeeming) {
    return;
  }


  const reward =
    selectedReward;


  const points =
    Number(
      portalData.student.current_points
    );


  const cost =
    Number(reward.cost);


  // 再检查一次积分
  // 防止打开弹窗后积分发生变化
  if (points < cost) {

    redeemModalMessage.textContent =
      `积分不足，还差 ${formatPoints(
        cost - points
      )} 分。`;

    return;

  }


  isRedeeming = true;


  confirmRedeemModal.disabled =
    true;

  cancelRedeemModal.disabled =
    true;


  confirmRedeemModal.textContent =
    "提交中……";


  redeemModalMessage.textContent =
    "";


  try {

    const {
      data,
      error
    } = await supabase.rpc(
      "request_reward",
      {
        p_access_code:
          accessCode,

        p_reward_id:
          reward.id
      }
    );


    if (error) {
      throw error;
    }


    if (!data?.success) {

      redeemModalMessage.textContent =
        data?.message ??
        "申请失败。";

      isRedeeming = false;

      confirmRedeemModal.disabled =
        false;

      cancelRedeemModal.disabled =
        false;

      confirmRedeemModal.textContent =
        "确认申请";

      return;

    }


    // 关闭弹窗
    redeemModal.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "modal-open"
    );


    selectedReward = null;


    alert(
      data.message ??
      "兑换申请已提交，等待老师审核。"
    );


    // 重新读取所有学生数据
    await loadStudentPortal();


  } catch (error) {

    console.error(
      "request_reward error:",
      error
    );


    redeemModalMessage.textContent =
      `申请失败：${error.message}`;


    isRedeeming = false;

    confirmRedeemModal.disabled =
      false;

    cancelRedeemModal.disabled =
      false;

    confirmRedeemModal.textContent =
      "确认申请";

  }

}


// =====================================================
// 工具函数
// =====================================================

function formatPoints(
  value
) {

  const number =
    Number(value ?? 0);


  return number
    .toFixed(1)
    .replace(
      /\.0$/,
      ""
    );

}


function formatSignedPoints(
  value
) {

  const number =
    Number(value ?? 0);

  const sign =
    number > 0
      ? "+"
      : number < 0
        ? "−"
        : "";

  return `${sign}${formatPoints(Math.abs(number))}`;

}


function getRankIcon(
  rank
) {

  if (rank === 1) return "🥇";

  if (rank === 2) return "🥈";

  if (rank === 3) return "🥉";

  return `#${rank}`;

}


function getCategoryName(
  category
) {

  const map = {

    performance:
      "课堂表现",

    practice:
      "作业练习",

    punishment:
      "惩罚分",

    special_reward:
      "特殊奖励",

    exam:
      "考试成绩"

  };


  return (
    map[category] ??
    "积分奖励"
  );

}


function formatRedemptionStatus(
  status
) {

  const map = {

    pending:
      "等待老师确认",

    approved:
      "兑换成功",

    rejected:
      "申请未通过"

  };


  return (
    map[status] ??
    status
  );

}


function formatDateTime(
  value
) {

  if (!value) return "";

  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleString(
    "zh-CN",
    {
      month: "numeric",
      day: "numeric",

      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


function showLoginMessage(
  message
) {

  if (!loginMessage) return;

  loginMessage.textContent =
    message;

}
// =====================================================
// 兑换确认弹窗控制
// =====================================================

function openRedeemModal(
  reward
) {

  if (!reward) return;


  selectedReward = reward;

  isRedeeming = false;


  const points =
    Number(
      portalData.student.current_points
    );

  const cost =
    Number(reward.cost);

  const remaining =
    points - cost;


  redeemModalTitle.textContent =
    reward.name ?? "奖品";


  redeemModalDescription.textContent =
    reward.description ?? "";


  redeemCurrentPoints.textContent =
    formatPoints(points);


  redeemCost.textContent =
    formatPoints(cost);


  redeemRemainingPoints.textContent =
    formatPoints(remaining);


  redeemModalMessage.textContent =
    "";


  confirmRedeemModal.disabled =
    false;

  confirmRedeemModal.textContent =
    "确认申请";


  if (reward.image_url) {

    redeemModalImage.src =
      reward.image_url;

    redeemModalImage.alt =
      reward.name ?? "奖品";

    redeemModalImage.classList.remove(
      "hidden"
    );

    redeemModalPlaceholder.classList.add(
      "hidden"
    );

  } else {

    redeemModalImage.src = "";

    redeemModalImage.classList.add(
      "hidden"
    );

    redeemModalPlaceholder.classList.remove(
      "hidden"
    );

  }


  redeemModal.classList.remove(
    "hidden"
  );


  // 防止打开弹窗后背景页面继续滚动
  document.body.classList.add(
    "modal-open"
  );

}



function closeRedeemModal() {

  if (isRedeeming) return;


  redeemModal.classList.add(
    "hidden"
  );


  document.body.classList.remove(
    "modal-open"
  );


  selectedReward = null;

}
cancelRedeemModal?.addEventListener(
  "click",
  closeRedeemModal
);


closeRedeemModalBtn?.addEventListener(
  "click",
  closeRedeemModal
);


document
  .querySelector(
    "[data-close-redeem-modal]"
  )
  ?.addEventListener(
    "click",
    closeRedeemModal
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      !redeemModal.classList.contains(
        "hidden"
      )
    ) {

      closeRedeemModal();

    }

  }
);
confirmRedeemModal?.addEventListener(
  "click",
  requestReward
);
