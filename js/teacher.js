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
const studentManagementSearch =
  document.querySelector("#studentManagementSearch");
const studentManagementSearchBtn =
  document.querySelector("#studentManagementSearchBtn");
let pendingRedemptions = [];
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
    refreshPointOptions();
    renderRewards();
	  await loadTodayRecords();
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
    data ?? [];

  renderRedemptions();

  updatePendingRedemptionCount();

}

async function loadClasses() {

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

  selectedClassId =
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
      <article class="student-management-row">
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
      </article>
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

exportAccessCodesBtn?.addEventListener(
  "click",
  exportAccessCodes
);

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

  const ruleId =
    Number(selectedOption?.dataset.ruleId);

  const pointValue =
    Number(pointsSelect.value);

  const desc =
    description.value.trim();

  if (selectedStudentIds.length === 0) {

    return showMessage(
      "请至少选择一名学生。",
      true
    );

  }

  if (!ruleId || !desc) {

    return showMessage(
      "请填写具体名称，并选择积分档位。",
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

  showMessage(
    `已给 ${selectedStudentIds.length} 名学生各加 +${formatPoints(pointValue)} 分。`
  );

  description.value = "";

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

            +${formatPoints(
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
