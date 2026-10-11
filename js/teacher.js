import { supabase, supabaseConfigured } from "./supabase.js";

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const authMessage = document.querySelector("#authMessage");
const emailInput = document.querySelector("#teacherEmail");
const passwordInput = document.querySelector("#teacherPassword");
const loginBtn = document.querySelector("#teacherLogin");

const studentChecklist = document.querySelector("#studentChecklist");
const selectedCount = document.querySelector("#selectedCount");
const examBatchPanel =
  document.querySelector("#examBatchPanel");

const examName =
  document.querySelector("#examName");

const examScoreList =
  document.querySelector("#examScoreList");

const examFilledCount =
  document.querySelector("#examFilledCount");

const examTotalPoints =
  document.querySelector("#examTotalPoints");

const examMessage =
  document.querySelector("#examMessage");
const categorySelect = document.querySelector("#categorySelect");
const description = document.querySelector("#description");
const pointsSelect = document.querySelector("#pointsSelect");
const rulePointsField = document.querySelector("#rulePointsField");
const customPointsField = document.querySelector("#customPointsField");
const customPointsLabel = document.querySelector("#customPointsLabel");
const customPoints = document.querySelector("#customPoints");
const customPointsHint = document.querySelector("#customPointsHint");
const saveMessage = document.querySelector("#saveMessage");
const studentArea =
  document.querySelector("#studentArea");

const normalPointArea =
  document.querySelector("#normalPointArea");

let students = [];
let rules = [];
let rewards = [];

let classes = [];
let selectedClassId = null;

const currentClass =
  document.querySelector("#currentClass");
const studentManagementList =
  document.querySelector("#studentManagementList");
const studentManagementMessage =
  document.querySelector("#studentManagementMessage");
const exportAccessCodesBtn =
  document.querySelector("#exportAccessCodesBtn");
const exportStudentPointsBtn =
  document.querySelector("#exportStudentPointsBtn");
const studentManagementSearch =
  document.querySelector("#studentManagementSearch");
const studentManagementSearchBtn =
  document.querySelector("#studentManagementSearchBtn");
const classPromotionModal =
  document.querySelector("#classPromotionModal");
const classPromotionTitle =
  document.querySelector("#classPromotionTitle");
const classPromotionSummary =
  document.querySelector("#classPromotionSummary");
const classPromotionStudentCount =
  document.querySelector("#classPromotionStudentCount");
const classPromotionStudentList =
  document.querySelector("#classPromotionStudentList");
const classPromotionNote =
  document.querySelector("#classPromotionNote");
const classPromotionMessage =
  document.querySelector("#classPromotionMessage");
const classPromotionLaterBtn =
  document.querySelector("#classPromotionLaterBtn");
const classPromotionConfirmBtn =
  document.querySelector("#classPromotionConfirmBtn");
let pendingRedemptions = [];
let redemptionAuditRecords = [];
let pendingClassPromotions = [];
let activeClassPromotion = null;
let studentManagementStudents = [];
let studentManagementSearchQuery = "";

if (!supabaseConfigured) {
  showAuthMessage("尚未填写 Supabase 配置，请检查 js/config.js。", true);
} else {
  bootAuth();
}

async function bootAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await enterDashboard();
  }
}

loginBtn.addEventListener("click", async () => {
  if (!supabaseConfigured) return;

  loginBtn.disabled = true;
  loginBtn.textContent = "登录中…";
  showAuthMessage("");

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    showAuthMessage(error.message, true);
  } else {
    await enterDashboard();
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "登录";
});

document.querySelector("#teacherLogout").addEventListener("click", async () => {
  closeClassPromotionModal();
  await supabase.auth.signOut();
  dashboardView.classList.add("hidden");
  authView.classList.remove("hidden");
  emailInput.value = "";
  passwordInput.value = "";
});

async function enterDashboard() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");

  document.querySelector("#today").textContent =
    new Date().toLocaleDateString("zh-CN", {
      year:"numeric", month:"long", day:"numeric"
    });

  try {
    await loadRules();
    await loadRewards();

    await loadClasses();
    await loadStudents();
    await loadRedemptions();
    await loadRedemptionAudit();
    refreshPointOptions();
    renderRewards();
	  await loadTodayRecords();

    try {
      await checkClassPromotionReminders();
    } catch (error) {
      console.error(
        "升班提醒检查失败：",
        error
      );
    }
  } catch (err) {
    showMessage(err.message || "加载失败。", true);
  }
}

async function loadRules() {
  const { data, error } = await supabase
    .from("point_rules")
    .select("*")
    .eq("active", true)
    .order("category")
    .order("points");
  if (error) throw error;
  rules = data ?? [];
}

async function loadRewards() {

  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .order("cost", {
      ascending: true
    });

  if (error) throw error;

  rewards = data ?? [];

}

async function loadRedemptions() {

  const { data, error } =
    await supabase
      .from("redemptions")
      .select(`
        id,
        student_id,
        reward_id,
        cost,
        status,
        requested_at,
        class_name_at_time,
        student_name_at_time,
        student_number_at_time,
        reward_name_at_time,
        students (
          name,
          student_number,
          class_id,
          classes (
            name
          )
        ),
        rewards (
          name,
          description,
          image_url
        )
      `)
      .eq("status", "pending")
      .order("requested_at", {
        ascending: true
      });

  if (error) {

    console.error(
      "loadRedemptions error:",
      error
    );

    throw error;

  }

  pendingRedemptions =
    (data ?? []).map(item => ({
      ...item,
      students: {
        ...(item.students ?? {}),
        name:
          item.student_name_at_time ??
          item.students?.name,
        student_number:
          item.student_number_at_time ??
          item.students?.student_number,
        classes: {
          name:
            item.class_name_at_time ??
            item.students?.classes?.name
        }
      },
      rewards: {
        ...(item.rewards ?? {}),
        name:
          item.reward_name_at_time ??
          item.rewards?.name
      }
    }));

  renderRedemptions();

  updatePendingRedemptionCount();

}

async function loadRedemptionAudit() {
  if (!selectedClassId) {
    redemptionAuditRecords = [];
    renderRedemptionAudit();
    return;
  }

  const { data: classStudents, error: studentsError } =
    await supabase
      .from("students")
      .select("id")
      .eq("class_id", selectedClassId);

  if (studentsError) throw studentsError;

  const currentStudentIds = new Set(
    (classStudents ?? []).map(student => Number(student.id))
  );

  const redemptionResult = await supabase
    .from("redemptions")
    .select(`
      id,
      student_id,
      cost,
      status,
      requested_at,
      processed_at,
      redeemed_at,
      class_id_at_time,
      student_name_at_time,
      reward_name_at_time,
      students (
        name
      ),
      rewards (
        name
      )
    `)
    .order("requested_at", { ascending: false });

  if (redemptionResult.error) throw redemptionResult.error;

  const visibleRedemptions = (redemptionResult.data ?? []).filter(record =>
    Number(record.class_id_at_time) === Number(selectedClassId) ||
    (!record.class_id_at_time && currentStudentIds.has(Number(record.student_id)))
  );

  const studentIds = [
    ...new Set(visibleRedemptions.map(record => Number(record.student_id)))
  ];

  if (!studentIds.length) {
    redemptionAuditRecords = [];
    renderRedemptionAudit();
    return;
  }

  const pointResult = await supabase
    .from("point_records")
    .select("id, student_id, points, record_date, created_at")
    .in("student_id", studentIds);

  if (pointResult.error) throw pointResult.error;

  const eventsByStudent = new Map();

  (pointResult.data ?? []).forEach(record => {
    if (!eventsByStudent.has(record.student_id)) {
      eventsByStudent.set(record.student_id, []);
    }

    eventsByStudent.get(record.student_id).push({
      kind: "points",
      id: record.id,
      time: record.created_at ?? record.record_date ?? "",
      points: Number(record.points) || 0
    });
  });

  (redemptionResult.data ?? [])
    .filter(redemption => studentIds.includes(Number(redemption.student_id)))
    .forEach(redemption => {
    if (!eventsByStudent.has(redemption.student_id)) {
      eventsByStudent.set(redemption.student_id, []);
    }

    if (redemption.status === "approved") {
      eventsByStudent.get(redemption.student_id).push({
        kind: "redemption",
        id: redemption.id,
        time:
          redemption.processed_at ??
          redemption.redeemed_at ??
          redemption.requested_at ??
          "",
        cost: Number(redemption.cost) || 0,
        redemptionId: redemption.id
      });
    }
  });

  const balanceAfterRedemption = new Map();

  eventsByStudent.forEach(events => {
    events.sort((left, right) => {
      const timeDifference =
        new Date(left.time).getTime() -
        new Date(right.time).getTime();

      if (timeDifference !== 0) return timeDifference;
      if (left.kind === right.kind) return Number(left.id) - Number(right.id);
      return left.kind === "points" ? -1 : 1;
    });

    let balance = 0;

    events.forEach(event => {
      if (event.kind === "points") {
        balance += event.points;
        return;
      }

      balance -= event.cost;
      balanceAfterRedemption.set(event.redemptionId, balance);
    });
  });

  redemptionAuditRecords = visibleRedemptions.map(record => ({
    ...record,
    studentName:
      record.student_name_at_time ??
      record.students?.name ??
      "学生",
    rewardName:
      record.reward_name_at_time ??
      record.rewards?.name ??
      "奖品",
    balanceAfter:
      record.status === "approved"
        ? balanceAfterRedemption.get(record.id)
        : null
  }));

  renderRedemptionAudit();
}

async function loadClasses(
  preferredClassId = selectedClassId
) {

  const { data, error } =
    await supabase
      .from("classes")
      .select("id, name")
      .order("name");

  if (error) throw error;

  classes = data ?? [];

  currentClass.innerHTML =
    classes.map(c => `
      <option value="${c.id}">
        ${escapeHtml(c.name)}
      </option>
    `).join("");

  if (classes.length === 0) {

    currentClass.innerHTML =
      `<option value="">
        暂无班级
      </option>`;

    selectedClassId = null;

    return;
  }

  const preferredClass =
    classes.find(
      item =>
        Number(item.id) ===
        Number(preferredClassId)
    );

  selectedClassId =
    preferredClass?.id ??
    classes[0].id;

  currentClass.value =
    String(selectedClassId);
}
currentClass.addEventListener(
  "change",
  async () => {

    selectedClassId =
      Number(currentClass.value);

    try {

      await loadStudents();

      renderStudents();

      if (
        categorySelect.value === "exam"
      ) {

        renderExamScoreList();

      }

      await loadTodayRecords();
      await loadRedemptionAudit();

    } catch (err) {

      showMessage(
        err.message ||
        "切换班级失败。",
        true
      );

    }

  }
);

async function loadStudents() {

  if (!selectedClassId) {

    students = [];

    renderStudentChecklist();
    studentManagementStudents = [];
    renderStudentManagement();

    return;
  }

  const selectedClass =
    classes.find(
      c =>
        Number(c.id) ===
        Number(selectedClassId)
    );

  if (!selectedClass) {

    students = [];

    renderStudentChecklist();
    studentManagementStudents = [];
    renderStudentManagement();

    return;
  }

  const { data, error } =
    await supabase
      .from("student_point_balances")
      .select("*")
      .eq(
        "class_name",
        selectedClass.name
      )
      .order("student_number");

  if (error) throw error;

  students = data ?? [];

  renderStudentChecklist();
  await loadStudentManagement();
}

async function loadStudentManagement() {
  if (!studentManagementList || !selectedClassId) {
    studentManagementStudents = [];
    renderStudentManagement();
    return;
  }

  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      class_id,
      student_number,
      name,
      access_code,
      active,
      classes (
        name
      )
    `)
    .eq("class_id", selectedClassId)
    .is("graduated_at", null)
    .order("student_number");

  if (error) throw error;

  const balanceById = new Map(
    students.map(student => [
      Number(student.student_id),
      Number(student.current_points)
    ])
  );

  studentManagementStudents = (data ?? []).map(student => ({
    ...student,
    class_name:
      student.classes?.name ??
      classes.find(item => Number(item.id) === Number(student.class_id))?.name ??
      "",
    current_points: balanceById.get(Number(student.id)) ?? 0
  }));

  renderStudentManagement();
}

function renderStudentManagement() {
  if (!studentManagementList) return;

  if (!selectedClassId) {
    studentManagementList.innerHTML =
      '<p class="muted student-management-empty">暂无班级。</p>';
    return;
  }

  const query = studentManagementSearchQuery.trim().toLocaleLowerCase();
  const filteredStudents = query
    ? studentManagementStudents.filter(student => [
        student.name,
        student.student_number,
        student.access_code,
        student.class_name
      ].some(value =>
        String(value ?? "").toLocaleLowerCase().includes(query)
      ))
    : studentManagementStudents;

  if (filteredStudents.length === 0) {
    studentManagementList.innerHTML =
      `<p class="muted student-management-empty">${query ? "没有找到匹配的学生。" : "当前班级还没有学生。"}</p>`;
    return;
  }

  const tableHead = `
    <div class="student-management-table-head" aria-hidden="true">
      <span>学号</span>
      <span>姓名</span>
      <span>班级</span>
      <span>登录码</span>
      <span>当前积分</span>
      <span>状态</span>
    </div>
  `;

  const rows = filteredStudents.map(student => {
    const statusText = student.active ? "在读" : "已停用";
    const statusClass = student.active ? "is-active" : "is-inactive";

    return `
      <button class="student-management-row" type="button"
        data-student-records="${student.id}"
        aria-expanded="false"
        aria-controls="student-records-${student.id}">
        <span class="student-management-number">
          ${escapeHtml(student.student_number)}号
        </span>
        <strong class="student-management-name">
          ${escapeHtml(student.name)}
        </strong>
        <span class="student-management-class">
          ${escapeHtml(student.class_name)}
        </span>
        <code class="student-management-code">
          ${escapeHtml(student.access_code)}
        </code>
        <strong class="student-management-points">
          ${formatPoints(student.current_points)}
        </strong>
        <span class="student-status ${statusClass}">${statusText}</span>
      </button>
      <div id="student-records-${student.id}" class="student-management-records" hidden></div>
    `;
  }).join("");

  studentManagementList.innerHTML = tableHead + rows;

  if (query) {
    const firstMatch = studentManagementList.querySelector(
      ".student-management-row"
    );

    firstMatch?.classList.add("is-search-match");
    firstMatch?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
  }
}

function searchStudentManagement() {
  studentManagementSearchQuery =
    studentManagementSearch?.value.trim() ?? "";
  renderStudentManagement();
}

studentManagementSearchBtn?.addEventListener(
  "click",
  searchStudentManagement
);

studentManagementSearch?.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      searchStudentManagement();
    }
  }
);

studentManagementList?.addEventListener("click", event => {
  const studentButton = event.target.closest("[data-student-records]");
  if (studentButton) {
    const panel = document.getElementById(studentButton.getAttribute("aria-controls"));
    panel.hidden = !panel.hidden;
    studentButton.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden && !panel.dataset.loaded) loadStudentRecords(panel, Number(studentButton.dataset.studentRecords));
    return;
  }

  const moreButton = event.target.closest("[data-load-student-records]");
  if (moreButton) {
    const panel = moreButton.closest(".student-management-records");
    loadStudentRecords(panel, Number(moreButton.dataset.loadStudentRecords));
  }
});

async function loadStudentRecords(panel, studentId) {
  if (panel.dataset.loading === "true") return;
  panel.dataset.loading = "true";
  const offset = Number(panel.dataset.offset ?? 0);
  const moreButton = panel.querySelector("[data-load-student-records]");
  if (moreButton) moreButton.disabled = true;
  if (!panel.dataset.loaded) panel.innerHTML = '<p class="muted">正在加载积分记录……</p>';

  const { data, error } = await supabase
    .from("point_records")
    .select("id, category, description, points, record_date, created_at, rule_name_at_time, raw_score")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + 49);

  if (!panel.isConnected) return;
  panel.dataset.loading = "false";
  if (error) {
    if (moreButton) moreButton.disabled = false;
    else panel.innerHTML = `<p class="muted">读取失败：${escapeHtml(error.message)}</p><button type="button" class="ghost-btn small" data-load-student-records="${studentId}">重试</button>`;
    return;
  }

  const records = data ?? [];
  if (!panel.dataset.loaded) {
    panel.innerHTML = records.length ? '<div class="student-management-record-list"></div>' : '<p class="muted">暂无积分录入记录。</p>';
    panel.dataset.loaded = "true";
  }
  panel.querySelector("[data-load-student-records]")?.remove();
  panel.querySelector(".student-management-record-list")?.insertAdjacentHTML("beforeend", records.map(record => `
    <div class="student-management-record">
      <div>
        <strong>${escapeHtml(getPointCategoryName(record.category))}${record.rule_name_at_time ? ` · ${escapeHtml(record.rule_name_at_time)}` : ["performance", "practice", "exam"].includes(record.category) ? " · 档位未保存" : ""}</strong>
        <small>${escapeHtml(record.description)}${record.raw_score == null ? "" : ` · 原始成绩 ${escapeHtml(record.raw_score)}`}</small>
      </div>
      <strong class="${Number(record.points) < 0 ? "point-negative" : "point-positive"}">${formatSignedPoints(record.points)}</strong>
      <time>${escapeHtml(formatPointRecordTime(record.created_at, record.record_date))}</time>
    </div>
  `).join(""));
  panel.dataset.offset = String(offset + records.length);
  if (records.length === 50) panel.insertAdjacentHTML("beforeend", `<button type="button" class="ghost-btn small" data-load-student-records="${studentId}">加载更多记录</button>`);
}

function getPointCategoryName(category) {
  return {
    performance: "课堂表现",
    practice: "作业练习",
    exam: "考试成绩",
    punishment: "惩罚扣分",
    special_reward: "特殊奖励"
  }[category] ?? "积分录入";
}

function formatPointRecordTime(createdAt, recordDate) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? String(recordDate ?? "时间未记录")
    : date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

exportAccessCodesBtn?.addEventListener(
  "click",
  exportAccessCodes
);

exportStudentPointsBtn?.addEventListener(
  "click",
  () => {
    exportStudentPoints().catch(error => {
      console.error("导出学生积分失败：", error);
      setStudentManagementMessage(
        error.message || "导出失败，请稍后重试。",
        true
      );
    });
  }
);

classPromotionLaterBtn?.addEventListener(
  "click",
  postponeClassPromotions
);

classPromotionConfirmBtn?.addEventListener(
  "click",
  confirmClassPromotion
);

async function checkClassPromotionReminders() {
  const { data, error } =
    await supabase.rpc(
      "get_pending_class_promotions"
    );

  if (error) throw error;

  if (data?.success === false) {
    throw new Error(
      data.message ||
      "无法检查升班提醒。"
    );
  }

  pendingClassPromotions =
    Array.isArray(data?.promotions)
      ? data.promotions
      : [];

  if (pendingClassPromotions.length) {
    showNextClassPromotion();
  }
}

function showNextClassPromotion() {
  activeClassPromotion =
    pendingClassPromotions[0] ??
    null;

  if (!activeClassPromotion) {
    closeClassPromotionModal();
    return;
  }

  const promotion =
    activeClassPromotion;
  const isGraduation =
    promotion.action === "graduate" ||
    Number(promotion.grade) === 9;
  const promotionStudents =
    Array.isArray(promotion.students)
      ? promotion.students
      : [];
  const dueDate =
    new Date(
      `${promotion.promotion_due_date}T00:00:00`
    ).toLocaleDateString(
      "zh-CN",
      {
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );

  classPromotionTitle.textContent =
    isGraduation
      ? `${promotion.class_name} 毕业确认`
      : `${promotion.class_name} 升班确认`;
  classPromotionSummary.textContent =
    isGraduation
      ? `该班已于 ${dueDate} 到达毕业时间，确认后将归档为已毕业学生。`
      : `该班已于 ${dueDate} 到达升班时间，确认后将升为 ${promotion.target_class_name}。`;
  classPromotionNote.textContent =
    isGraduation
      ? "确认后，学生资料会复制到“已毕业学生”档案并保留积分、兑换历史，当前学生账号会停用；原班级会保留。"
      : "确认后，以上学生将迁移到下一年级；选择“稍后处理”只关闭本次提醒，下次登录仍会再次显示。";
  classPromotionConfirmBtn.textContent =
    isGraduation
      ? "确认毕业"
      : "确认升班";
  classPromotionStudentCount.textContent =
    `${promotion.student_count ?? promotionStudents.length} 人`;
  classPromotionStudentList.innerHTML =
    promotionStudents.map(student => `
      <div class="class-promotion-student">
        <span>${escapeHtml(student.student_number ?? "—")}</span>
        <strong>${escapeHtml(student.name ?? "未命名学生")}</strong>
      </div>
    `).join("");
  classPromotionMessage.textContent = "";
  classPromotionMessage.classList.remove(
    "is-error"
  );
  classPromotionModal.classList.remove(
    "hidden"
  );
  document.body.classList.add(
    "modal-open"
  );
  classPromotionConfirmBtn.focus();
}

function postponeClassPromotions() {
  pendingClassPromotions = [];
  activeClassPromotion = null;
  closeClassPromotionModal();
}

function closeClassPromotionModal() {
  classPromotionModal?.classList.add(
    "hidden"
  );
  document.body.classList.remove(
    "modal-open"
  );
}

async function confirmClassPromotion() {
  if (!activeClassPromotion) return;

  const promotion =
    activeClassPromotion;
  const isGraduation =
    promotion.action === "graduate" ||
    Number(promotion.grade) === 9;

  classPromotionConfirmBtn.disabled = true;
  classPromotionLaterBtn.disabled = true;
  classPromotionConfirmBtn.textContent =
    isGraduation
      ? "正在归档…"
      : "正在升班…";
  classPromotionMessage.textContent =
    "正在迁移学生，请稍候……";
  classPromotionMessage.classList.remove(
    "is-error"
  );

  try {
    const { data, error } =
      await supabase.rpc(
        "confirm_class_promotion",
        {
          p_class_id:
            Number(
              promotion.class_id
            )
        }
      );

    if (error) throw error;

    if (data?.success === false) {
      throw new Error(
        data.message ||
        "班级升级失败。"
      );
    }

    pendingClassPromotions.shift();
    activeClassPromotion = null;
    classPromotionMessage.textContent =
      data?.message ||
      (isGraduation
        ? `${promotion.class_name} 毕业归档完成。`
        : `${promotion.class_name} 升班完成。`);

    try {
      await loadClasses(
        Number(
          data?.to_class_id ??
          selectedClassId
        )
      );
      await loadStudents();
      renderStudents();

      if (
        categorySelect.value === "exam"
      ) {
        renderExamScoreList();
      }

      await loadTodayRecords();
      await loadRedemptionAudit();
    } catch (refreshError) {
      console.error(
        "升班后刷新页面数据失败：",
        refreshError
      );
    }

    setTimeout(
      () => {
        closeClassPromotionModal();
        showNextClassPromotion();
      },
      700
    );
  } catch (error) {
    classPromotionMessage.textContent =
      error.message ||
      (isGraduation
        ? "毕业归档失败，请稍后重试。"
        : "班级升级失败，请稍后重试。");
    classPromotionMessage.classList.add(
      "is-error"
    );
  } finally {
    classPromotionConfirmBtn.disabled = false;
    classPromotionLaterBtn.disabled = false;
    classPromotionConfirmBtn.textContent =
      isGraduation
        ? "确认毕业"
        : "确认升班";
  }
}

function exportAccessCodes() {
  if (!selectedClassId) {
    setStudentManagementMessage("请先选择一个班级。", true);
    return;
  }

  if (studentManagementStudents.length === 0) {
    setStudentManagementMessage("当前班级没有可导出的学生。", true);
    return;
  }

  if (typeof XLSX === "undefined") {
    setStudentManagementMessage("导出组件尚未加载，请刷新页面后重试。", true);
    return;
  }

  const selectedClass = classes.find(
    item => Number(item.id) === Number(selectedClassId)
  );
  const className = selectedClass?.name ?? "当前班级";
  const exportRows = studentManagementStudents.map(student => ({
    班级: student.class_name || className,
    学号: String(student.student_number ?? ""),
    姓名: student.name ?? "",
    登录码: student.access_code ?? "",
    状态: student.active ? "在读" : "已停用",
    当前积分: Number(student.current_points ?? 0)
  }));

  exportAccessCodesBtn.disabled = true;
  exportAccessCodesBtn.textContent = "正在导出…";

  try {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 20 },
      { wch: 10 },
      { wch: 12 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "学生登录码");

    const date = new Date().toISOString().slice(0, 10);
    const safeClassName = className.replace(/[\\/:*?"<>|]/g, "-");
    XLSX.writeFile(
      workbook,
      `学生登录码-${safeClassName}-${date}.xlsx`
    );

    setStudentManagementMessage(
      `已导出 ${exportRows.length} 名学生的登录码。`
    );
  } catch (error) {
    console.error("导出登录码失败：", error);
    setStudentManagementMessage(
      error.message || "导出失败，请稍后重试。",
      true
    );
  } finally {
    exportAccessCodesBtn.disabled = false;
    exportAccessCodesBtn.textContent = "导出登录码";
  }
}

async function exportStudentPoints() {
  setStudentManagementMessage("正在准备学生积分导出…");

  if (!selectedClassId) {
    setStudentManagementMessage("请先选择一个班级。", true);
    return;
  }

  if (studentManagementStudents.length === 0) {
    setStudentManagementMessage("当前班级没有可导出的学生。", true);
    return;
  }

  const xlsx = window.XLSX;
  if (!xlsx) {
    setStudentManagementMessage("导出组件尚未加载，请刷新页面后重试。", true);
    return;
  }

  exportStudentPointsBtn.disabled = true;
  exportStudentPointsBtn.textContent = "正在导出…";

  try {
    const studentIds = studentManagementStudents.map(student => student.id);
    const pointRecords = [];
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("point_records")
        .select("student_id, points, record_date")
        .in("student_id", studentIds)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const page = data ?? [];
      pointRecords.push(...page);

      if (page.length < pageSize) break;
    }

    const pointStatsByStudent = new Map();

    pointRecords.forEach(record => {
      const studentId = Number(record.student_id);
      const recordDate = String(record.record_date ?? "");
      const stats = pointStatsByStudent.get(studentId) ?? {
        totalPoints: 0,
        firstRecordDate: ""
      };

      stats.totalPoints += Number(record.points ?? 0);

      if (
        recordDate &&
        (!stats.firstRecordDate || recordDate < stats.firstRecordDate)
      ) {
        stats.firstRecordDate = recordDate;
      }

      pointStatsByStudent.set(studentId, stats);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exportRows = studentManagementStudents.map(student => {
      const stats = pointStatsByStudent.get(Number(student.id));
      let dailyAveragePoints = 0;

      if (stats?.firstRecordDate) {
        const firstRecordDate = new Date(`${stats.firstRecordDate}T00:00:00`);
        const elapsedDays = Math.max(
          Math.floor((today - firstRecordDate) / 86400000) + 1,
          1
        );
        dailyAveragePoints = Math.round(
          (stats.totalPoints / elapsedDays) * 10
        ) / 10;
      }

      return {
        姓名: student.name ?? "",
        积分: Number(student.current_points ?? 0),
        日均积分: dailyAveragePoints
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 14 }
    ];
    worksheet["!autofilter"] = {
      ref: worksheet["!ref"]
    };

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "学生积分");

    const selectedClass = classes.find(
      item => Number(item.id) === Number(selectedClassId)
    );
    const className = selectedClass?.name ?? "当前班级";
    const safeClassName = className.replace(/[\\/:*?"<>|]/g, "-");
    const date = new Date().toISOString().slice(0, 10);

    xlsx.writeFile(
      workbook,
      `学生积分余额-${safeClassName}-${date}.xlsx`
    );

    setStudentManagementMessage(
      `已导出 ${exportRows.length} 名学生的积分余额。`
    );
  } catch (error) {
    console.error("导出学生积分失败：", error);
    setStudentManagementMessage(
      error.message || "导出失败，请稍后重试。",
      true
    );
  } finally {
    exportStudentPointsBtn.disabled = false;
    exportStudentPointsBtn.textContent = "导出学生积分";
  }
}

function setStudentManagementMessage(text, error = false) {
  if (!studentManagementMessage) return;

  studentManagementMessage.textContent = text;
  studentManagementMessage.style.color = error ? "#b96f6f" : "#668b76";
}

function renderStudentChecklist() {

  studentChecklist.innerHTML = students.map(student => `
    <label class="student-check">

      <input
        type="checkbox"
        class="student-box"
        value="${student.student_id}"
      >

      <span>
        ${escapeHtml(student.student_number)}号 ·
        ${escapeHtml(student.name)}
      </span>

      <small>
        ${formatPoints(student.current_points)} pts
      </small>

    </label>
  `).join("");

  document
    .querySelectorAll(".student-box")
    .forEach(box => {
      box.addEventListener("change", updateSelectedCount);
    });

  updateSelectedCount();
}

function getSelectedStudentIds() {

  return [
    ...document.querySelectorAll(".student-box:checked")
  ].map(box => Number(box.value));

}

function updateSelectedCount() {

  const count = getSelectedStudentIds().length;

  selectedCount.textContent = `已选 ${count} 人`;

}
document
  .querySelector("#selectAllStudents")
  .addEventListener("click", () => {

    document
      .querySelectorAll(".student-box")
      .forEach(box => {
        box.checked = true;
      });

    updateSelectedCount();

  });

document
  .querySelector("#clearStudents")
  .addEventListener("click", () => {

    document
      .querySelectorAll(".student-box")
      .forEach(box => {
        box.checked = false;
      });

    updateSelectedCount();

  });

categorySelect.addEventListener(
  "change",
  () => {

    const isExam =
      categorySelect.value === "exam";

    normalPointArea.classList.toggle(
      "hidden",
      isExam
    );

    studentArea.classList.toggle(
      "hidden",
      isExam
    );

    examBatchPanel.classList.toggle(
      "hidden",
      !isExam
    );

    if (isExam) {

      renderExamScoreList();

    } else {

      refreshPointOptions();

    }

  }
);

function refreshPointOptions() {
  const category = categorySelect.value;
  const isPunishment = category === "punishment";
  const isSpecialReward = category === "special_reward";
  const usesCustomPoints = isPunishment || isSpecialReward;

  rulePointsField.classList.toggle("hidden", usesCustomPoints);
  customPointsField.classList.toggle("hidden", !usesCustomPoints);

  if (usesCustomPoints) {
    customPointsLabel.textContent = isPunishment
      ? "扣除积分"
      : "奖励积分";
    customPointsHint.textContent = isPunishment
      ? "输入正数即可，保存时会自动记为扣分。"
      : "最多支持 1 位小数，保存后直接计入学生账户。";
    description.placeholder = isPunishment
      ? "如：未按要求完成任务"
      : "如：活动特别贡献";
    return;
  }

  description.placeholder = "如：困难问题 / Unit 2 作业";
  const categoryRules = rules.filter(r => r.category === category);

  pointsSelect.innerHTML = categoryRules.map(r => `
    <option value="${r.points}" data-rule-id="${r.id}">
      ${escapeHtml(r.rule_name)} · +${formatPoints(r.points)}
    </option>
  `).join("");

}

document.querySelector("#savePoint").addEventListener("click", savePoint);

async function savePoint() {

  const selectedStudentIds =
    getSelectedStudentIds();

  const category =
    categorySelect.value;

  const selectedOption =
    pointsSelect.selectedOptions[0];

  const usesCustomPoints =
    category === "punishment" ||
    category === "special_reward";

  const ruleId =
    usesCustomPoints
      ? null
      : Number(selectedOption?.dataset.ruleId);

  const customPointValue =
    Number(customPoints.value);

  const pointValue = usesCustomPoints
    ? category === "punishment"
      ? -customPointValue
      : customPointValue
    : Number(pointsSelect.value);

  const desc =
    description.value.trim();

  if (selectedStudentIds.length === 0) {

    return showMessage(
      "请至少选择一名学生。",
      true
    );

  }

  if (!desc) {

    return showMessage(
      "请填写具体名称。",
      true
    );

  }

  if (
    usesCustomPoints &&
    (
      !Number.isFinite(customPointValue) ||
      customPointValue <= 0 ||
      customPointValue > 999999.9 ||
      Math.abs(customPointValue * 10 - Math.round(customPointValue * 10)) > 1e-8
    )
  ) {

    return showMessage(
      "自定义积分必须大于 0，且最多保留 1 位小数。",
      true
    );

  }

  if (!usesCustomPoints && (!ruleId || !Number.isFinite(pointValue))) {

    return showMessage(
      "请选择一个有效的积分档位。",
      true
    );

  }

  const rows =
    selectedStudentIds.map(studentId => ({

      student_id: studentId,

      category: category,

      description: desc,

      raw_score: null,

      points: pointValue,

      rule_id: ruleId,

      record_date:
        new Date()
          .toISOString()
          .slice(0, 10)

    }));

  const { error } =
    await supabase
      .from("point_records")
      .insert(rows);

  if (error) {

    return showMessage(
      error.message,
      true
    );

  }

  const resultMessage = category === "punishment"
    ? `已为 ${selectedStudentIds.length} 名学生各扣除 ${formatPoints(Math.abs(pointValue))} 分。`
    : `已给 ${selectedStudentIds.length} 名学生各加 +${formatPoints(pointValue)} 分。`;

  showMessage(resultMessage);

  description.value = "";
  customPoints.value = "";

  document
    .querySelectorAll(".student-box")
    .forEach(box => {
      box.checked = false;
    });

  updateSelectedCount();

  await loadStudents();

  renderStudents();

  await loadTodayRecords();

}
async function loadTodayRecords() {

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const { data, error } =
    await supabase
      .from("point_records")

      .select(`
        id,
        student_id,
        category,
        description,
        points,
        record_date,
        students (
          name,
          student_number
        )
      `)

      .eq("record_date", today)

      .order("id", {
        ascending: false
      })

      .limit(100);

  if (error) {

    document.querySelector(
      "#todayRecords"
    ).innerHTML =
      `<p class="muted">
        无法读取今日记录：
        ${escapeHtml(error.message)}
      </p>`;

    return;

  }

  const classStudentIds =
  new Set(
    students.map(
      student =>
        Number(student.student_id)
    )
  );

  const records =
  (data ?? []).filter(
    record =>
      classStudentIds.has(
        Number(record.student_id)
      )
  );

  document.querySelector(
    "#todayRecordCount"
  ).textContent =
    `${records.length} 条`;

  if (records.length === 0) {

    document.querySelector(
      "#todayRecords"
    ).innerHTML =
      `<p class="muted">
        今天还没有录入积分。
      </p>`;

    return;

  }

  document.querySelector(
    "#todayRecords"
  ).innerHTML =

    records.map(record => `

      <article class="record-item">

        <div class="record-main">

          <strong>
            ${escapeHtml(
              record.students?.student_number ?? ""
            )}号 ·

            ${escapeHtml(
              record.students?.name ?? "学生"
            )}
          </strong>

          <small>

            ${escapeHtml(
              record.description
            )}

            ·

            ${formatSignedPoints(
              record.points
            )}

          </small>

        </div>

        <button
          class="undo-btn"
          data-undo="${record.id}"
        >
          撤销
        </button>

      </article>

    `).join("");

  document
    .querySelectorAll("[data-undo]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          undoRecord(
            Number(button.dataset.undo)
          )
      );

    });

}
async function undoRecord(id) {

  const confirmed =
    confirm(
      "确定撤销这条积分记录吗？\n\n撤销后学生积分会同步减少。"
    );

  if (!confirmed) return;

  const { error } =
    await supabase
      .from("point_records")
      .delete()
      .eq("id", id);

  if (error) {

    return showMessage(
      error.message,
      true
    );

  }

  showMessage(
    "已撤销这条积分记录。"
  );

  await loadStudents();

  renderStudents();

  await loadTodayRecords();

}

function renderRewards() {

  document.querySelector(
    "#rewardAdminList"
  ).innerHTML = rewards.map(r => `

    <div class="admin-row">

      <div class="reward-admin-info">

        ${
          r.image_url
            ? `
              <img
                class="reward-admin-thumb"
                src="${escapeHtml(r.image_url)}"
                alt="${escapeHtml(r.name)}"
              >
            `
            : `
              <div class="reward-admin-placeholder">
                🎁
              </div>
            `
        }

        <div class="reward-admin-details">

          <strong>
            🎁 ${escapeHtml(r.name)}
          </strong>

          <small>
            ${r.cost} 积分 ·
            ${escapeHtml(r.description ?? "")}
          </small>

        </div>

      </div>

      <span
        class="reward-admin-status ${r.active ? "is-active" : "is-inactive"}"
        role="status"
        aria-label="奖品状态：${r.active ? "在售" : "已停用"}"
      >
        ${r.active ? "在售" : "已停用"}
      </span>

      <div class="admin-actions">

        <button
          class="ghost-btn"
          data-edit="${r.id}"
        >
          编辑
        </button>

        <button
          class="ghost-btn"
          data-toggle="${r.id}"
        >
          ${r.active ? "停用" : "恢复"}
        </button>

      </div>

    </div>

  `).join("");

  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const reward =
            rewards.find(
              r =>
                r.id ===
                Number(button.dataset.edit)
            );

          if (!reward) return;

          openRewardModal(reward);

        }
      );

    });

  document
    .querySelectorAll("[data-toggle]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          toggleReward(
            Number(button.dataset.toggle)
          );

        }
      );

    });

}

async function toggleReward(id) {

  const reward = rewards.find(r => r.id === id);

  if (!reward) return;

  const newStatus = !reward.active;

  const action = newStatus ? "恢复" : "停用";

  const confirmed = confirm(
    `确定要${action}「${reward.name}」吗？`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("rewards")
    .update({
      active: newStatus
    })
    .eq("id", id);

  if (error) {

    alert(`操作失败：${error.message}`);

    return;
  }

  await loadRewards();

  renderRewards();

}

function renderStudents() {
  renderStudentManagement();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#panel-${tab.dataset.panel}`).classList.add("active");
  });
});

function showAuthMessage(text, error = false) {
  authMessage.textContent = text;
  authMessage.style.color = error ? "#c25a5a" : "#1f9d70";
}
function showMessage(text, error = false) {
  saveMessage.textContent = text;
  saveMessage.style.color = error ? "#c25a5a" : "#1f9d70";
}
function formatPoints(n) {
  return Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1);
}
function formatSignedPoints(n) {
  const value = Number(n);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatPoints(Math.abs(value))}`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
function renderExamScoreList() {
  examScoreList.innerHTML =
    students.map(student => `

      <div
        class="exam-score-row"
        data-student-id="${student.student_id}"
      >

        <span>
          ${escapeHtml(student.student_number)}号
        </span>

        <strong>
          ${escapeHtml(student.name)}
        </strong>

        <input
          type="number"
          class="exam-score-input"
          min="0"
          max="120"
          step="1"
          placeholder="成绩"
        >

        <span class="exam-result zero">
          —
        </span>

      </div>

    `).join("");

  document
    .querySelectorAll(".exam-score-input")
    .forEach(input => {

      input.addEventListener(
        "input",
        updateExamPreview
      );

    });

  updateExamPreview();

}

function getExamRule(score) {
  const value = Number(score);

  if (!Number.isFinite(value)) {
    return null;
  }

  return rules.find(rule =>
    rule.category === "exam" &&
    value >= Number(rule.min_score) &&
    value <= Number(rule.max_score)
  ) ?? null;
}

function getExamPoints(score) {
  const rule = getExamRule(score);
  return rule ? Number(rule.points) : 0;
}

function updateExamPreview() {

  let filled = 0;
  let totalPoints = 0;

  document
    .querySelectorAll(".exam-score-row")
    .forEach(row => {

      const input =
        row.querySelector(
          ".exam-score-input"
        );

      const result =
        row.querySelector(
          ".exam-result"
        );

      const score =
        Number(input.value);

      if (
        input.value === "" ||
        !Number.isFinite(score)
      ) {

        result.textContent = "—";

        result.className =
          "exam-result zero";

        return;

      }

      filled++;

      const points =
        getExamPoints(score);

      totalPoints += points;

      result.textContent =
        `+${formatPoints(points)}`;

      result.className =
        points > 0
          ? "exam-result good"
          : "exam-result zero";

    });

  examFilledCount.textContent =
    `已录入 ${filled} 人`;

  examTotalPoints.textContent =
    `预计积分 ${formatPoints(totalPoints)}`;

}

document
  .querySelector("#saveExamBatch")
  .addEventListener(
    "click",
    saveExamBatch
  );

async function saveExamBatch() {

  const name =
    examName.value.trim();

  if (!name) {

    examMessage.textContent =
      "请填写测试名称。";

    return;

  }

  const rows = [];

  document
    .querySelectorAll(".exam-score-row")
    .forEach(row => {

      const input =
        row.querySelector(
          ".exam-score-input"
        );

      const score =
        Number(input.value);

      // 没填成绩的学生直接跳过
      if (
        input.value === "" ||
        !Number.isFinite(score)
      ) {

        return;

      }

      const studentId =
        Number(
          row.dataset.studentId
        );

      const points =
        getExamPoints(score);

      const rule = getExamRule(score);

      if (!rule) return;

      rows.push({

        student_id:
          studentId,

        category:
          "exam",

        description:
          name,

        raw_score:
          score,

        points:
          points,

        rule_id:
          rule.id,

        record_date:
          new Date()
            .toISOString()
            .slice(0, 10)

      });

    });

  if (rows.length === 0) {

    examMessage.textContent =
      "还没有录入任何成绩。";

    return;

  }

  const confirmed =
    confirm(
      `本次将录入 ${rows.length} 名学生的考试成绩。\n\n确定保存吗？`
    );

  if (!confirmed) return;

  const { error } =
    await supabase
      .from("point_records")
      .insert(rows);

  if (error) {

    examMessage.textContent =
      error.message;

    return;

  }

  examMessage.textContent =
    `成功录入 ${rows.length} 名学生的考试积分。`;

  // 清空成绩
  document
    .querySelectorAll(".exam-score-input")
    .forEach(input => {

      input.value = "";

    });

  examName.value = "";

  updateExamPreview();

  await loadStudents();

  renderStudents();

  await loadTodayRecords();

}

async function uploadRewardImage(file) {

  if (!file) {
    return null;
  }

  // 5MB 限制
  if (file.size > 5 * 1024 * 1024) {

    throw new Error(
      "图片不能超过 5MB。"
    );

  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {

    throw new Error(
      "只支持 JPG、PNG 或 WebP 图片。"
    );

  }

  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();

  const fileName =
    `${crypto.randomUUID()}.${extension}`;

  const filePath =
    `rewards/${fileName}`;

  const { error } =
    await supabase.storage
      .from("reward-images")
      .upload(
        filePath,
        file,
        {
          cacheControl: "3600",
          upsert: false
        }
      );

  if (error) {
    throw error;
  }

  const { data } =
    supabase.storage
      .from("reward-images")
      .getPublicUrl(
        filePath
      );

  return data.publicUrl;

}

const rewardModal =
  document.querySelector(
    "#rewardModal"
  );

const rewardModalTitle =
  document.querySelector(
    "#rewardModalTitle"
  );

const editingRewardId =
  document.querySelector(
    "#editingRewardId"
  );

const rewardName =
  document.querySelector(
    "#rewardName"
  );

const rewardCost =
  document.querySelector(
    "#rewardCost"
  );

const rewardDescription =
  document.querySelector(
    "#rewardDescription"
  );

const rewardImage =
  document.querySelector(
    "#rewardImage"
  );

const rewardImagePreview =
  document.querySelector(
    "#rewardImagePreview"
  );

const rewardPreviewImg =
  document.querySelector(
    "#rewardPreviewImg"
  );

const rewardModalMessage =
  document.querySelector(
    "#rewardModalMessage"
  );

function openRewardModal(
  reward = null
) {

  rewardModal.classList.remove(
    "hidden"
  );

  rewardModalMessage.textContent =
    "";

  rewardImage.value = "";

  if (reward) {

    rewardModalTitle.textContent =
      "编辑奖品";

    editingRewardId.value =
      reward.id;

    rewardName.value =
      reward.name ?? "";

    rewardCost.value =
      reward.cost ?? "";

    rewardDescription.value =
      reward.description ?? "";

    if (reward.image_url) {

      rewardPreviewImg.src =
        reward.image_url;

      rewardImagePreview
        .classList
        .remove("hidden");

    } else {

      rewardImagePreview
        .classList
        .add("hidden");

    }

  } else {

    rewardModalTitle.textContent =
      "添加奖品";

    editingRewardId.value = "";

    rewardName.value = "";

    rewardCost.value = "";

    rewardDescription.value = "";

    rewardPreviewImg.src = "";

    rewardImagePreview
      .classList
      .add("hidden");

  }

}

function closeRewardModal() {

  rewardModal
    .classList
    .add("hidden");

}

document
  .querySelector("#closeRewardModal")
  .addEventListener(
    "click",
    closeRewardModal
  );

document
  .querySelector("#cancelRewardModal")
  .addEventListener(
    "click",
    closeRewardModal
  );

document
  .querySelector("#addReward")
  .addEventListener(
    "click",
    () => openRewardModal()
  );

rewardImage.addEventListener(
  "change",
  () => {

    const file =
      rewardImage.files[0];

    if (!file) return;

    const url =
      URL.createObjectURL(file);

    rewardPreviewImg.src =
      url;

    rewardImagePreview
      .classList
      .remove("hidden");

  }
);

document
  .querySelector("#saveRewardModal")
  .addEventListener(
    "click",
    saveRewardModal
  );

async function saveRewardModal() {

  const name =
    rewardName.value.trim();

  const cost =
    Number(rewardCost.value);

  const description =
    rewardDescription.value.trim();

  const id =
    editingRewardId.value;

  if (!name) {

    rewardModalMessage.textContent =
      "请填写奖品名称。";

    return;

  }

  if (
    !Number.isFinite(cost) ||
    cost < 0
  ) {

    rewardModalMessage.textContent =
      "请输入有效的积分数值。";

    return;

  }

  rewardModalMessage.textContent =
    "正在保存……";

  try {

    let imageUrl = null;

    // =========================
    // 编辑已有奖品
    // =========================

    if (id) {

      const oldReward =
        rewards.find(
          r => r.id === Number(id)
        );

      imageUrl =
        oldReward?.image_url ?? null;

      const file =
        rewardImage.files[0];

      if (file) {

        imageUrl =
          await uploadRewardImage(
            file
          );

      }

      const { error } =
        await supabase
          .from("rewards")
          .update({

            name,

            cost,

            description,

            image_url:
              imageUrl

          })
          .eq(
            "id",
            Number(id)
          );

      if (error) {
        throw error;
      }

    }

    // =========================
    // 新增奖品
    // =========================

    else {

      const file =
        rewardImage.files[0];

      if (file) {

        imageUrl =
          await uploadRewardImage(
            file
          );

      }

      const { error } =
        await supabase
          .from("rewards")
          .insert({

            name,

            cost,

            description,

            active: true,

            image_url:
              imageUrl

          });

      if (error) {
        throw error;
      }

    }

    // =========================
    // 成功
    // =========================

    closeRewardModal();

    await loadRewards();

    renderRewards();

  } catch (error) {

    rewardModalMessage.textContent =
      `保存失败：${error.message}`;

  }

}
function renderRedemptions() {

  const container =
    document.querySelector(
      "#redemptionAdminList"
    );

  if (!container) return;

  if (
    pendingRedemptions.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-state">

        <strong>
          🎉 暂无待审核兑换
        </strong>

        <p class="muted">
          学生提交新的兑换申请后会显示在这里。
        </p>

      </div>
    `;

    return;

  }

  container.innerHTML =
    pendingRedemptions.map(item => {

      const student =
        item.students ?? {};

      const reward =
        item.rewards ?? {};

      const className =
        student.classes?.name ?? "";

      const requestedTime =
        item.requested_at
          ? new Date(
              item.requested_at
            ).toLocaleString(
              "zh-CN",
              {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              }
            )
          : "";

      return `

        <article
          class="redemption-admin-card"
        >

          <div
            class="redemption-admin-main"
          >

            <div
              class="redemption-student"
            >

              <strong>
                ${escapeHtml(
                  student.student_number ?? ""
                )}号 ·
                ${escapeHtml(
                  student.name ?? "学生"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  className
                )}
              </small>

            </div>

            <div
              class="redemption-reward"
            >

              ${
                reward.image_url
                  ? `
                    <img
                      src="${escapeHtml(
                        reward.image_url
                      )}"
                      alt=""
                      class="redemption-thumb"
                    >
                  `
                  : `
                    <div
                      class="redemption-thumb placeholder"
                    >
                      🎁
                    </div>
                  `
              }

              <div>

                <strong>
                  ${escapeHtml(
                    reward.name ?? "奖品"
                  )}
                </strong>

                <small>
                  消耗
                  <b>
                    ${formatPoints(
                      item.cost
                    )}
                  </b>
                  积分
                </small>

              </div>

            </div>

            <small
              class="redemption-time"
            >
              申请时间：
              ${escapeHtml(
                requestedTime
              )}
            </small>

          </div>

          <div
            class="admin-actions"
          >

            <button
              class="ghost-btn danger-btn"
              data-reject-redemption="${item.id}"
              type="button"
            >
              拒绝
            </button>

            <button
              class="primary-btn"
              data-approve-redemption="${item.id}"
              type="button"
            >
              通过兑换
            </button>

          </div>

        </article>

      `;

    }).join("");

  bindRedemptionActions();

}

function renderRedemptionAudit() {
  const container =
    document.querySelector("#redemptionAuditList");

  if (!container) return;

  if (!redemptionAuditRecords.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>暂无审核记录</strong>
        <p class="muted">切换班级后会显示该班级的全部兑换记录。</p>
      </div>
    `;
    return;
  }

  const statusMap = {
    approved: {
      label: "审核通过",
      className: "is-approved"
    },
    rejected: {
      label: "已拒绝",
      className: "is-rejected"
    },
    pending: {
      label: "待审核",
      className: "is-pending"
    }
  };

  const formatAuditDate = value => {
    if (!value) return "—";
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  container.innerHTML = `
    <div class="redemption-audit-row redemption-audit-header">
      <div class="redemption-audit-cell"><strong>学生姓名</strong></div>
      <div class="redemption-audit-cell"><strong>兑换物品</strong></div>
      <div class="redemption-audit-cell"><strong>兑换后积分流水</strong></div>
      <div class="redemption-audit-cell"><strong>审核意见</strong></div>
      <div class="redemption-audit-cell"><strong>日期</strong></div>
    </div>
    ${redemptionAuditRecords.map(record => {
      const status =
        statusMap[record.status] ?? {
          label: record.status ?? "未知",
          className: "is-pending"
        };
      const pointsFlow =
        record.status === "approved"
          ? `-${formatPoints(record.cost)}，余额 ${formatPoints(record.balanceAfter ?? 0)}`
          : "未扣除积分";
      const auditDate =
        record.processed_at ??
        record.redeemed_at ??
        record.requested_at;

      return `
        <div class="redemption-audit-row">
          <div class="redemption-audit-cell">
            <span class="redemption-audit-label">学生姓名</span>
            <strong>${escapeHtml(record.studentName)}</strong>
          </div>
          <div class="redemption-audit-cell">
            <span class="redemption-audit-label">兑换物品</span>
            <strong>${escapeHtml(record.rewardName)}</strong>
          </div>
          <div class="redemption-audit-cell redemption-audit-points">
            <span class="redemption-audit-label">兑换后积分流水</span>
            ${escapeHtml(pointsFlow)}
          </div>
          <div class="redemption-audit-cell">
            <span class="redemption-audit-label">审核意见</span>
            <span class="redemption-audit-opinion ${status.className}">
              ${escapeHtml(status.label)}
            </span>
          </div>
          <div class="redemption-audit-cell">
            <span class="redemption-audit-label">日期</span>
            ${escapeHtml(formatAuditDate(auditDate))}
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function bindRedemptionActions() {

  document
    .querySelectorAll(
      "[data-approve-redemption]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          approveRedemption(
            Number(
              button.dataset
                .approveRedemption
            )
          );

        }
      );

    });

  document
    .querySelectorAll(
      "[data-reject-redemption]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          rejectRedemption(
            Number(
              button.dataset
                .rejectRedemption
            )
          );

        }
      );

    });

}

async function approveRedemption(id) {

  const item =
    pendingRedemptions.find(
      r => r.id === id
    );

  if (!item) return;

  const student =
    item.students ?? {};

  const reward =
    item.rewards ?? {};

  const confirmed =
    confirm(
      `确定通过这项兑换申请吗？

学生：${student.student_number ?? ""}号 · ${student.name ?? ""}

奖品：${reward.name ?? ""}

消耗：${formatPoints(item.cost)} 积分

通过后积分将正式扣除。`
    );

  if (!confirmed) return;

  const { data, error } =
    await supabase.rpc(
      "approve_redemption",
      {
        p_redemption_id: id
      }
    );

  if (error) {

    alert(
      `审核失败：${error.message}`
    );

    return;

  }

  if (!data?.success) {

    alert(
      data?.message ??
      "兑换审核失败。"
    );

    return;

  }

  alert(
    "兑换审核通过！"
  );

  await loadRedemptions();
  await loadRedemptionAudit();

  await loadStudents();

  renderStudents();

}

async function rejectRedemption(id) {

  const item =
    pendingRedemptions.find(
      r => r.id === id
    );

  if (!item) return;

  const student =
    item.students ?? {};

  const reward =
    item.rewards ?? {};

  const confirmed =
    confirm(
      `确定拒绝这项兑换申请吗？

学生：${student.student_number ?? ""}号 · ${student.name ?? ""}

奖品：${reward.name ?? ""}

申请不会扣除学生积分。`
    );

  if (!confirmed) return;

  const { data, error } =
    await supabase.rpc(
      "reject_redemption",
      {
        p_redemption_id: id
      }
    );

  if (error) {

    alert(
      `操作失败：${error.message}`
    );

    return;

  }

  if (!data?.success) {

    alert(
      data?.message ??
      "拒绝申请失败。"
    );

    return;

  }

  alert(
    "已拒绝该兑换申请。"
  );

  await loadRedemptions();
  await loadRedemptionAudit();

}

function updatePendingRedemptionCount() {

  const badge =
    document.querySelector(
      "#pendingRedemptionCount"
    );

  if (!badge) return;

  const count =
    pendingRedemptions.length;

  badge.textContent =
    count;

  badge.classList.toggle(
    "hidden",
    count === 0
  );

}

document
  .querySelector(
    "#refreshRedemptions"
  )
  ?.addEventListener(
    "click",
    loadRedemptions
  );

document
  .querySelector(
    "#refreshRedemptionAudit"
  )
  ?.addEventListener(
    "click",
    loadRedemptionAudit
  );

/* =========================================================
   学生管理 · 批量导入
   ========================================================= */

const importStudentsBtn =
  document.querySelector(
    "#importStudentsBtn"
  );

const studentImportFile =
  document.querySelector(
    "#studentImportFile"
  );

importStudentsBtn?.addEventListener(
  "click",
  () => {

    studentImportFile?.click();

  }
);

studentImportFile?.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files?.[0];

    if (!file) return;

    try {

      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array"
          }
        );

      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rows =
        XLSX.utils.sheet_to_json(
          firstSheet,
          {
            defval: ""
          }
        );

      renderStudentImportPreview(
        rows
      );

    } catch (error) {

      console.error(error);

      showMessage(
        "无法读取 Excel 文件。",
        true
      );

    }

    /*
     * 允许再次选择同一个文件
     */
    event.target.value = "";

  }
);
function renderStudentImportPreview(rows) {

  const preview =
    document.querySelector(
      "#studentImportPreview"
    );

  if (!preview) return;

  /*
   * 清理空行
   */
  const cleanedRows =
    rows.filter(row => {

      return (
        String(row["班级"] ?? "").trim() ||
        String(row["学号"] ?? "").trim() ||
        String(row["姓名"] ?? "").trim()
      );

    });

  const errors = [];

  const normalized =
    cleanedRows.map((row, index) => {

      const className =
        String(
          row["班级"] ?? ""
        ).trim();

      const studentNumber =
        String(
          row["学号"] ?? ""
        ).trim();

      const name =
        String(
          row["姓名"] ?? ""
        ).trim();

      if (!className) {

        errors.push(
          `第 ${index + 2} 行：班级为空`
        );

      }

      if (!studentNumber) {

        errors.push(
          `第 ${index + 2} 行：学号为空`
        );

      }

      if (!name) {

        errors.push(
          `第 ${index + 2} 行：姓名为空`
        );

      }

      return {
        className,
        studentNumber,
        name
      };

    });

  /*
   * 检查 Excel 内部重复
   */
  const seen =
    new Set();

  normalized.forEach(
    (student, index) => {

      if (
        !student.className ||
        !student.studentNumber
      ) {

        return;

      }

      const key =
        `${student.className}__${student.studentNumber}`;

      if (seen.has(key)) {

        errors.push(
          `第 ${index + 2} 行：班级 + 学号重复`
        );

      }

      seen.add(key);

    }
  );

  preview.hidden = false;

  preview.innerHTML = `

    <div class="import-preview-head">

      <div>

        <h3 class="import-preview-title">
          导入预览
        </h3>

        <div class="import-preview-count">
          共 ${normalized.length} 名学生
        </div>

      </div>

    </div>

    <table class="import-preview-table">

      <thead>

        <tr>
          <th>班级</th>
          <th>学号</th>
          <th>姓名</th>
          <th>状态</th>
        </tr>

      </thead>

      <tbody>

        ${normalized.map(student => `

          <tr>

            <td>
              ${escapeHtml(student.className)}
            </td>

            <td>
              ${escapeHtml(student.studentNumber)}
            </td>

            <td>
              ${escapeHtml(student.name)}
            </td>

            <td class="import-preview-ok">
              ✓ 待导入
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>

    ${
      errors.length
        ? `
          <div class="import-preview-error-box">

            <strong>
              发现 ${errors.length} 个问题：
            </strong>

            <br>

            ${errors
              .map(error =>
                escapeHtml(error)
              )
              .join("<br>")}

          </div>
        `
        : ""
    }

    <div class="import-preview-actions">

      <button
        id="cancelStudentImport"
        class="ghost-btn"
        type="button"
      >
        取消
      </button>

      <button
        id="confirmStudentImport"
        class="primary-btn"
        type="button"
        ${
          errors.length
            ? "disabled"
            : ""
        }
      >
        确认导入 ${normalized.length} 名学生
      </button>

    </div>

  `;

  document
    .querySelector(
      "#cancelStudentImport"
    )
    ?.addEventListener(
      "click",
      () => {

        preview.hidden = true;

        preview.innerHTML = "";

      }
    );

  document
  .querySelector(
    "#confirmStudentImport"
  )
  ?.addEventListener(
    "click",
    async () => {

      await importStudentsToDatabase(
        normalized
      );

    }
  );

}

async function importStudentsToDatabase(
  studentsToImport
) {

  const button =
    document.querySelector(
      "#confirmStudentImport"
    );

  if (!studentsToImport.length) {

    showMessage(
      "没有可导入的学生。",
      true
    );

    return;

  }

  if (button) {

    button.disabled = true;

    button.textContent =
      "正在导入……";

  }

  try {

    /* =========================
       1. 获取涉及的班级
       ========================= */

    const classNames =
      [
        ...new Set(
          studentsToImport.map(
            student =>
              student.className
          )
        )
      ];

    const {
      data: existingClasses,
      error: classError
    } =
      await supabase
        .from("classes")
        .select("id, name")
        .in(
          "name",
          classNames
        );

    if (classError) {

      throw classError;

    }

    const classMap =
      new Map(
        (existingClasses ?? [])
          .map(
            item => [
              item.name,
              item
            ]
          )
      );

    /* =========================
       2. 自动创建不存在的班级
       ========================= */

    const missingClasses =
      classNames.filter(
        name =>
          !classMap.has(name)
      );

    for (
      const className
      of missingClasses
    ) {

      const {
        data: newClass,
        error
      } =
        await supabase
          .from("classes")
          .insert({
            name: className
          })
          .select("id, name")
          .single();

      if (error) {

        throw error;

      }

      classMap.set(
        newClass.name,
        newClass
      );

    }

    /* =========================
       3. 查询已有学生
       ========================= */

    const classIds =
      [
        ...classMap.values()
      ].map(
        item =>
          item.id
      );

    const {
      data: existingStudents,
      error: studentError
    } =
      await supabase
        .from("students")
        .select(
          "id, class_id, student_number, name"
        )
        .in(
          "class_id",
          classIds
        );

    if (studentError) {

      throw studentError;

    }

    const existingStudentMap =
      new Map();

    (
      existingStudents ?? []
    ).forEach(student => {

      const key =
        `${student.class_id}__${student.student_number}`;

      existingStudentMap.set(
        key,
        student
      );

    });

    /* =========================
       4. 准备新学生
       ========================= */

    const rowsToInsert = [];

    const skipped = [];

    for (
      const student
      of studentsToImport
    ) {

      const classItem =
        classMap.get(
          student.className
        );

      if (!classItem) {

        skipped.push({
          ...student,
          reason: "班级不存在"
        });

        continue;

      }

      const key =
        `${classItem.id}__${student.studentNumber}`;

      if (
        existingStudentMap.has(key)
      ) {

        skipped.push({
          ...student,
          reason:
            "该班级已有相同学号"
        });

        continue;

      }

      /*
       * 生成随机 access_code
       */

      let accessCode;

      let isUnique = false;

      while (!isUnique) {

        accessCode =
          generateAccessCode(8);

        const {
          data: duplicate,
          error
        } =
          await supabase
            .from("students")
            .select("id")
            .eq(
              "access_code",
              accessCode
            )
            .maybeSingle();

        if (error) {

          throw error;

        }

        isUnique =
          !duplicate;

      }

      rowsToInsert.push({

        class_id:
          classItem.id,

        student_number:
          student.studentNumber,

        name:
          student.name,

        access_code:
          accessCode,

        active:
          true

      });

    }

    /* =========================
       5. 写入 students
       ========================= */

    let inserted = [];

    if (rowsToInsert.length) {

      const {
        data,
        error
      } =
        await supabase
          .from("students")
          .insert(rowsToInsert)
          .select(
            "id, class_id, student_number, name, access_code"
          );

      if (error) {

        throw error;

      }

      inserted =
        data ?? [];

    }

    /* =========================
       6. 显示导入结果
       ========================= */

    renderStudentImportResult(
      inserted,
      skipped
    );

  } catch (error) {

    console.error(
      "学生导入失败：",
      error
    );

    showMessage(
      error.message ||
      "学生导入失败。",
      true
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        `确认导入 ${studentsToImport.length} 名学生`;

    }

  }

}

function generateAccessCode(length = 8) {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let result = "";

  for (
    let i = 0;
    i < length;
    i++
  ) {

    result +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }

  return result;

}
function renderStudentImportResult(
  inserted,
  skipped
) {

  const preview =
    document.querySelector(
      "#studentImportPreview"
    );

  if (!preview) return;

  preview.hidden = false;

  preview.innerHTML = `

    <div class="import-preview-head">

      <div>

        <h3 class="import-preview-title">
          导入完成
        </h3>

        <div class="import-preview-count">

          成功 ${inserted.length} 人

          ${
            skipped.length
              ? ` · 跳过 ${skipped.length} 人`
              : ""
          }

        </div>

      </div>

    </div>

    ${
      inserted.length
        ? `

          <table class="import-preview-table">

            <thead>

              <tr>
                <th>班级</th>
                <th>学号</th>
                <th>姓名</th>
                <th>登录码</th>
              </tr>

            </thead>

            <tbody>

              ${inserted.map(student => {

                const classItem =
                  classes.find(
                    c =>
                      Number(c.id) ===
                      Number(student.class_id)
                  );

                return `

                  <tr>

                    <td>
                      ${
                        escapeHtml(
                          classItem?.name ?? ""
                        )
                      }
                    </td>

                    <td>
                      ${
                        escapeHtml(
                          student.student_number
                        )
                      }
                    </td>

                    <td>
                      ${
                        escapeHtml(
                          student.name
                        )
                      }
                    </td>

                    <td
                      class="import-preview-ok"
                    >

                      <strong>
                        ${
                          escapeHtml(
                            student.access_code
                          )
                        }
                      </strong>

                    </td>

                  </tr>

                `;

              }).join("")}

            </tbody>

          </table>

        `
        : ""
    }

    ${
      skipped.length
        ? `

          <div
            class="import-preview-error-box"
          >

            <strong>
              以下学生未导入：
            </strong>

            <br><br>

            ${skipped.map(student => `

              ${escapeHtml(
                student.className
              )}

              ·

              ${escapeHtml(
                student.studentNumber
              )}

              ·

              ${escapeHtml(
                student.name
              )}

              — ${escapeHtml(
                student.reason
              )}

              <br>

            `).join("")}

          </div>

        `
        : ""
    }

    <div
      class="import-preview-actions"
    >

      <button
        id="closeStudentImportResult"
        class="ghost-btn"
        type="button"
      >
        完成
      </button>

    </div>

  `;

  document
    .querySelector(
      "#closeStudentImportResult"
    )
    ?.addEventListener(
      "click",
      () => {

        preview.hidden = true;

        preview.innerHTML = "";

        /*
         * 刷新教师端学生数据
         */

        loadStudents();

        renderStudents();

      }
    );

}
