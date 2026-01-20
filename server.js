const express = require("express");
const dayjs = require("dayjs");
const UAParser = require("ua-parser-js");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const session = require("express-session");
const bcrypt = require("bcryptjs");

// ===== IP 城市解析 =====
const ip2region = require("ip2region");

const app = express();

dotenv.config();

app.use(cors({}));
app.use(bodyParser.json());

// ===== session =====
app.use(
  session({
    name: "admin.sid",
    secret: "fwaehgifdhcvjdskfiweahndcnsijiwaksncds",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 2,
      secure: process.env.NODE_ENV === "production",
      rolling: true,
    },
  })
);

// ===== 数据库 =====
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ===== 邮件 =====
const transporter = nodemailer.createTransport({
  host: "smtp.exmail.qq.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.PASS_EMAIL,
  },
});

// ===== 静态资源 =====
app.use("/image", express.static(path.join(__dirname, "static/image")));
app.use("/", express.static(path.join(__dirname, "static")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

/* =============================
   工具函数
============================= */

// 获取真实 IP
function getClientIp(req) {
  let ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "";

  if (ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
}

// IP → 城市
function getCityByIp(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return "本地";
  }

  try {
    const res = ip2region.search(ip);
    return `${res.province || ""}${res.city || ""}` || "未知";
  } catch {
    return "未知";
  }
}

/* =============================
   表单提交接口
============================= */

app.post("/api/submit", (req, res) => {
  const { name, phone, timestamp, userAgent } = req.body;

  // 1️⃣ IP & 城市（后端算）
  const clientIp = getClientIp(req);
  const city = getCityByIp(clientIp);

  // 2️⃣ 时间
  const formattedTime = dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");

  // 3️⃣ UA 解析
  // ===== UA 解析（拆字段）=====
  const parser = new UAParser(userAgent);
  const ua = parser.getResult();

  // 系统
  const osName = ua.os.name || "未知系统";
  const osVersion = ua.os.version || "";
  const os = `${osName} ${osVersion}`.trim(); // iOS 18.5

  // 设备型号
  const device = ua.device.model || "未知设备"; // iPhone

  // 品牌（英文 → 中文）
  let brand = ua.device.vendor || "未知";

  if (brand.toLowerCase() === "apple") {
    brand = "苹果";
  } else if (brand.toLowerCase() === "huawei") {
    brand = "华为";
  } else if (brand.toLowerCase() === "xiaomi") {
    brand = "小米";
  }

  // 4️⃣ SQL（⚠️ system 是关键字，要反引号）
  const sql = `
    INSERT INTO bookings
    (name, phone, ip, city, timestamp, os, device, brand)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [name, phone, clientIp, city, formattedTime, os, device, brand],
    (err) => {
      if (err) {
        console.error("数据库错误:", err);
        return res.status(500).json({ message: "预约失败" });
      }

      // 先返回给前端
      res.json({ message: "预约成功" });

      // 后台发邮件
      transporter.sendMail({
        from: process.env.USER_EMAIL,
        to: process.env.TO_EMAIL,
        subject: "新预约信息",
        text: `
姓名：${name}
手机：${phone}
IP：${clientIp}
城市：${city}
时间：${formattedTime}
系统：${os}
设备：${device}
手机品牌：${brand}
        `,
      });
    }
  );
});

/* =============================
   初始化管理员账号
============================= */

const checkAndInsertUser = () => {
  const username = "admin";
  const password = "123456";

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, rows) => {
      if (err) return console.error(err);

      if (rows.length === 0) {
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) return;

          db.query("INSERT INTO users (username, password) VALUES (?, ?)", [
            username,
            hash,
          ]);
        });
      }
    }
  );
};
// app.post("/api/login", (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res
//       .status(400)
//       .json({ success: false, message: "用户名和密码不能为空" });
//   }

//   const query = "SELECT * FROM users WHERE username = ?";
//   db.query(query, [username], (err, result) => {
//     if (err) {
//       console.error("查询错误", err);
//       return res.status(500).json({ success: false, message: "服务器错误" });
//     }
//   const query = "SELECT * FROM users WHERE username = ?";
//   db.query(query, [username], (err, result) => {
//     if (err) {
//       console.error("查询错误", err);
//       return res.status(500).json({ success: false, message: "服务器错误" });
//     }

//     if (result.length > 0) {
//       // 比对密码
//       const user = result[0];
//       bcrypt.compare(password, user.password, (err, isMatch) => {
//         if (err) {
//           console.error("密码比较错误", err);
//           return res
//             .status(500)
//             .json({ success: false, message: "服务器错误" });
//         }
//         if (isMatch) {
//           //res.status(200).json({ success: true, message: "登录成功" });
//           req.session.admin = {
//             username: "admin",
//           };
//           res.status(200).json({ success: true, message: "登录成功" });
//         } else {
//           res.status(401).json({ success: false, message: "账号或密码错误" });
//         }
//       });
//     } else {
//       res.status(401).json({ success: false, message: "账号或密码错误" });
//     }
//   });
// });
// function requireAdmin(req, res, next) {
//   if (req.session && req.session.admin) {
//     next();
//   } else {
//     res.status(401).json({
//       success: false,
//       message: "未登录或登录已过期",
//     });
//   }
// }

// // 获取提交的记录列表
// app.get("/api/list", requireAdmin, (req, res) => {
//   const { startDate, endDate } = req.query;

//   // 转换日期格式：确保传入的日期是 'YYYY-MM-DD HH:MM:SS' 格式
//   const formatDate = (date, isEndDate = false) => {
//     if (date) {
//       const [year, month, day] = date.split("-");
//       // 如果是结束日期，将时间设置为 23:59:59
//       return isEndDate
//         ? `${year}-${month}-${day} 23:59:59`
//         : `${year}-${month}-${day} 00:00:00`;
//     }
//     return null;
//   };
//   // 格式化日期
//   const startDateFormatted = formatDate(startDate);
//   const endDateFormatted = formatDate(endDate, true); // 设置结束时间为 23:59:59

//   let query = "SELECT * FROM bookings WHERE 1=1";
//   let params = [];

//   if (startDateFormatted) {
//     query += " AND timestamp >= ?";
//     params.push(startDateFormatted);
//   }
//   if (endDateFormatted) {
//     query += " AND timestamp <= ?";
//     params.push(endDateFormatted);
//   }

//   query += " ORDER BY timestamp DESC";

//   // 调试：查看查询语句和参数
//   console.log("Executing query:", query);
//   console.log("With params:", params);
//   db.query(query, params, (err, rows) => {
//     if (err) {
//       console.error("查询失败:", err);
//       res.status(500).json({ message: "查询失败" });
//     } else {
//       console.log("Query result:", rows);
//       res.status(200).json({ success: true, data: rows });
//     }
//   });
// });

// // 删除某条记录
// app.delete("/api/list/:id", requireAdmin, (req, res) => {
//   const { id } = req.params;

//   const query = "DELETE FROM bookings WHERE id = ?";
//   db.query(query, [id], (err, result) => {
//     if (err) {
//       console.error(err);
//       res.status(500).json({ success: false, message: "删除失败" });
//     } else {
//       res.status(200).json({ success: true, message: "删除成功" });
//     }
//   });
// });
// // 提供后台列表页（实际使用中应该有登录验证）
// app.get("/admin/list", (req, res) => {
//   if (req.session && req.session.admin) {
//     res.sendFile(path.join(__dirname, "admin-list.html"));
//   } else {
//     res.redirect("/admin");
//   }
// });
// app.post("/api/logout", (req, res) => {
//   req.session.destroy((err) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: "退出失败" });
//     }
//     // 清除cookie
//     res.clearCookie("admin.sid"); // 注意这里的 cookie 名称
//     res.json({ success: true });
//   });
// });

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
