console.log("JavaScript 文件加载成功！");

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded 事件触发");
  const loginForm = document.getElementById("loginForm");
  console.log("loginForm 元素:", loginForm);

  if (loginForm) {
    console.log("找到了 loginForm 元素");
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      console.log("表单提交");

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const loginBtn = document.getElementById("loginBtn");

      // 禁用登录按钮
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';

      // 发起后台验证请求
      fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            // 跳转到列表页
            window.location.href = "admin-list.html";
          } else {
            alert("账号或密码错误！");
            loginBtn.disabled = false;
            loginBtn.innerHTML = "登录";
          }
        })
        .catch((err) => {
          console.error("登录请求失败", err);
          alert("登录失败，请稍后再试！");
          loginBtn.disabled = false;
          loginBtn.innerHTML = "登录";
        });
    });
  }
});
