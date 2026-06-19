import { getStatValue } from './shop.js';
import { isCustomMode } from './mathEngine.js';

// Draws a 5-axis Radar Chart for math areas performance analysis
export function drawRadarChart(correctAnswers, totalAnswers) {
  const canvas = document.getElementById("certChartCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 80;
  
  const labels = isCustomMode()
    ? ["단어 매칭", "카테고리 분류", "순발력", "집중력", "정확도"]
    : ["약수", "배수", "관계", "공약수", "공배수"];
  const numAxes = labels.length;

  // Calculate scores (default to 60% if no questions answered yet to prevent empty graphs)
  const scores = labels.map((_, idx) => {
    const correct = correctAnswers[idx + 1] || 0;
    const total = totalAnswers[idx + 1] || 0;
    return total > 0 ? (correct / total) : 0.6; // fallback baseline 60%
  });

  // 1. Draw web grid circles (20%, 40%, 60%, 80%, 100%)
  ctx.strokeStyle = "#e2ded5";
  ctx.lineWidth = 1;
  for (let r = 0.2; r <= 1.0; r += 0.2) {
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius * r;
      const y = centerY + Math.sin(angle) * radius * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 2. Draw axis lines
  ctx.strokeStyle = "#cda869";
  for (let i = 0; i < numAxes; i++) {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.stroke();

    // Draw Labels
    const labelX = centerX + Math.cos(angle) * (radius + 20);
    const labelY = centerY + Math.sin(angle) * (radius + 15);
    ctx.fillStyle = "#614d33";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[i], labelX, labelY);
  }

  // 3. Draw performance polygon
  ctx.strokeStyle = "rgba(160, 32, 240, 0.8)";
  ctx.fillStyle = "rgba(160, 32, 240, 0.25)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  for (let i = 0; i < numAxes; i++) {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
    const scoreVal = Math.max(0.1, Math.min(1.0, scores[i])); // clamp
    const x = centerX + Math.cos(angle) * radius * scoreVal;
    const y = centerY + Math.sin(angle) * radius * scoreVal;
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw data nodes
  ctx.fillStyle = "#ff007f";
  for (let i = 0; i < numAxes; i++) {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
    const scoreVal = Math.max(0.1, Math.min(1.0, scores[i]));
    const x = centerX + Math.cos(angle) * radius * scoreVal;
    const y = centerY + Math.sin(angle) * radius * scoreVal;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Fills in name, statistics, radar charts, and triggers UI display
export function showCertificate(player, correctAnswers, totalAnswers, finalStage = 50) {
  document.getElementById("certScreen").classList.remove("hidden");
  document.getElementById("certNameText").innerText = player.name;
  document.getElementById("certStageText").innerText = `${finalStage} STAGE`;

  const titleEl = document.querySelector("#certContainer h1");
  if (titleEl) {
    titleEl.innerText = isCustomMode() ? "교과 분류 특공대 수료 인증서" : "수학 특공대 수료 인증서";
  }
  
  const descEl = document.querySelector("#certContainer .cert-desc");
  if (descEl) {
    descEl.innerText = isCustomMode()
      ? `위 특공대원 ${player.name}은(는) 다양한 교과 지식과 생물 분류의 거친 전투에서 훌륭한 용기와 지혜로 미션을 완수하였기에 이 인증서를 수여합니다.`
      : `위 특공대원 ${player.name}은(는) 약수와 배수의 거친 수학 전투에서 훌륭한 용기와 지혜로 미션을 완수하였기에 이 인증서를 수여합니다.`;
  }
  
  // Calculate final score based on level, gold and stats
  const finalScore = finalStage * 1000 + player.level * 1500 + Math.floor(player.gold * 0.5);
  document.getElementById("certScoreText").innerText = finalScore.toLocaleString();

  // Evaluation Grades
  const modePrefix = isCustomMode() ? "분류" : "수학";
  let grade = "예비 특공대원";
  if (player.level >= 45) grade = `${modePrefix} 엠페러`;
  else if (player.level >= 30) grade = `${modePrefix} 마스터`;
  else if (player.level >= 15) grade = `${modePrefix} 특공대장`;
  if (finalStage >= 45) grade = `${modePrefix} 슈퍼스타`;
  else if (finalStage >= 30) grade = `${modePrefix} 마스터`;
  else if (finalStage >= 15) grade = `${modePrefix} 특공대`;
  else grade = "예비 특공대";
  document.getElementById("certGradeText").innerText = grade;

  // Generate Unique Cert number
  const certNo = Math.floor(100000 + Math.random() * 900000);
  document.getElementById("certNoText").innerText = certNo;

  // Draw Chart
  drawRadarChart(correctAnswers, totalAnswers);

  // Set Date
  const dateObj = new Date();
  document.getElementById("certDateText").innerText = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;

  // Feedback Text generator
  const strengthElement = document.getElementById("certStrengthText");
  const weaknessElement = document.getElementById("certWeaknessText");
  const commentElement = document.getElementById("certCommentText");

  // Determine strengths and weaknesses
  const labels = ["", "약수", "배수", "관계", "공약수", "공배수"];
  let bestAreaIdx = 1;
  let worstAreaIdx = 1;
  let maxRate = -1;
  let minRate = 2;

  for (let i = 1; i <= 5; i++) {
    const correct = correctAnswers[i] || 0;
    const total = totalAnswers[i] || 0;
    const rate = total > 0 ? correct / total : 0.6;
    if (rate > maxRate) {
      maxRate = rate;
      bestAreaIdx = i;
    }
    if (rate < minRate) {
      minRate = rate;
      worstAreaIdx = i;
    }
  }

  // Handle equal edge cases
  if (bestAreaIdx === worstAreaIdx) {
    worstAreaIdx = (bestAreaIdx % 5) + 1;
  }

  const strengthTexts = {
    1: "약수의 정의와 주어진 자연수 범위 내에서의 약수 추출 속도가 뛰어납니다.",
    2: "배수의 기본 규칙을 스스로 정확히 찾아 나가는 뛰어난 연산 능력을 가졌습니다.",
    3: "곱셈식의 빈칸과 구조 분석을 통한 수 관계 파악에 강점을 가집니다.",
    4: "공약수와 최대공약수 개념에 강력한 직관과 정확도를 지녔습니다.",
    5: "공배수와 최소공배수의 성질 및 수학적 응용력이 돋보입니다."
  };

  const weaknessTexts = {
    1: "나누어떨어지는 수(약수)를 나열하여 빠뜨리지 않고 찾는 보충 학습을 권장합니다.",
    2: "특정 자연수의 배수 관계를 직관적으로 판단하는 연산 연습이 더 요구됩니다.",
    3: "약수와 배수의 유기적인 인과 곱셈식에 대한 기본 개념 보완이 필요합니다.",
    4: "두 수의 공약수와 최대공약수의 정의와 성질을 차분하게 나열하는 훈련을 추천합니다.",
    5: "최소공배수의 실제 실생활 문장제 문제에 대한 해독 능력 강화가 필요합니다."
  };

  const commentTexts = {
    1: "수의 기본적인 성질을 탐색하는 능력이 탁월합니다. 5-1단원 기초가 탄탄하게 완성되어 향후 분수의 약분과 통분 과정에서 높은 학습 성취가 기대됩니다.",
    2: "약수/배수의 기본 원리를 빠르게 직관하고 활용하는 집중력이 훌륭합니다. 약점 영역을 복습을 통해 꾸준히 다듬는다면 학급 탑 수학 마스터가 될 수 있습니다.",
    3: "복잡한 기믹과 수학 퍼즐에 대처하는 연산 실력이 준수합니다. 기계적으로 공식을 풀지 않고 직접 나열하며 원리를 파악하려 한 수학적 태도를 높이 칭찬합니다.",
    4: "위기를 극복하는 대처력과 수의 관계성에 대한 이해도가 깊습니다. 수학 특공대의 정식 우수 졸업생으로서 자격을 충분히 인정합니다.",
    5: "최종 보스의 차원 융합 수학 기믹에 훌륭하게 대처한 역량이 돋보입니다. 수료 이후 중학교 1학년 소인수분해 과정으로 자연스럽게 연계 학습을 권장합니다."
  };

  if (isCustomMode()) {
    strengthElement.innerText = "다양한 교과 단어와 카테고리의 관계를 빠르고 정확하게 분석해내는 능력이 탁월합니다.";
    weaknessElement.innerText = "특정 단어들이 어떤 분류에 속하는지 헷갈리지 않도록 복습을 통한 보완 학습을 추천합니다.";
    commentElement.innerText = "특공대의 정식 수료원으로서, 교과 퀴즈의 다양한 함정을 훌륭하게 극복하고 지혜롭게 문제를 해결한 점을 높이 칭찬합니다. 앞으로의 다른 심화 과정도 훌륭히 수행할 준비가 되었습니다!";
  } else {
    strengthElement.innerText = strengthTexts[bestAreaIdx];
    weaknessElement.innerText = weaknessTexts[worstAreaIdx];
    commentElement.innerText = commentTexts[bestAreaIdx];
  }
}

// Convert HTML area to Canvas and download as PNG image file
export function saveCertificate() {
  const certContainer = document.getElementById("certContainer");
  if (!certContainer) return;

  // Open the external link in a new browser window/tab
  window.open("https://samboard.vivasam.com/studentEntry/?brdId=brd-0QR3C3WJN6RYH", "_blank");

  html2canvas(certContainer, {
    scale: 2, // Retain high quality
    backgroundColor: "#fdfdfc",
    useCORS: true
  }).then(canvas => {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = isCustomMode() ? `교과분류특공대_인증서.png` : `수학특공대_인증서.png`;
    link.href = dataUrl;
    link.click();
  });
}
