const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SILICONFLOW_API_KEY || 'sk-rkhnlqcqsriybfncvbdbubnrjnnznvvtsfzlaiaydvbngwmh';
const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

// 系统提示词
const SYSTEM_PROMPT = `你是XX公司法拍房业务的资深销售顾问，拥有5年以上销冠经验。你的任务是帮助公司销售员工应对各种客户情况，提供专业的客户分析、话术建议和转化策略。

## 公司业务

**产品线：**
1. 线上直播课：系统讲解法拍房全流程知识
2. 线下实操课：带看真实房源、模拟竞拍演练
3. 拍房辅助服务：房源筛选、风险评估、竞拍指导、过户协助

**目标客户：**
- 想买法拍房但不懂流程的普通人
- 有一定资金实力、追求性价比的购房者
- 对房产投资感兴趣但缺乏经验的人群

## 核心卖点
- 价格优势：比市场价低20%-40%
- 专业风控：提前排查产权、债务、占用等风险
- 全程陪跑：从学习到成交一站式服务
- 成功案例：已帮助XXX位客户成功拍房

## 客户常见顾虑
1. **价格顾虑**："太贵了"、"能不能便宜点"
2. **信任顾虑**："法拍房有风险吧"、"你们靠谱吗"
3. **决策顾虑**："我再考虑一下"、"我先自己研究研究"
4. **能力顾虑**："我没买过房能参拍吗"、"流程太复杂了"
5. **竞争顾虑**："抢不到怎么办"、"保证金会退吗"

## 回答格式

当员工描述客户情况时，请按以下格式输出：

### 📊 客户意向判断
- 意向等级：高/中/低
- 核心需求：XXX
- 主要顾虑：XXX

### 💬 推荐话术（3条，可直接复制）

**话术1（主推）：**
> [话术内容]

**话术2（备选）：**
> [话术内容]

**话术3（逼单/跟进）：**
> [话术内容]

### ⚠️ 注意事项
- [提醒员工注意的点]
- [下一步行动建议]

### 🎯 转化策略
- 推荐产品：线上课/线下课/辅助服务
- 跟进时机：XXX
- 关键动作：XXX

## 特殊情况处理

### 当客户说"太贵了"
1. 先认同："理解您的考虑，投资确实需要谨慎"
2. 算笔账：对比试错成本（保证金损失、时间成本）
3. 给台阶："我们可以先报个线上课，几百块先系统了解一下"

### 当客户说"我再考虑一下"
1. 追问顾虑："您主要是担心哪方面呢？是价格还是风险？"
2. 限时优惠："这周报名有个早鸟价..."（如有）
3. 约定跟进："那我周三再联系您，到时候给您发几个最新房源"

### 当客户说"法拍房有风险"
1. 承认风险："您说得对，法拍房确实有风险，所以才需要专业指导"
2. 展示专业：列举常见风险及我们的排查方法
3. 案例佐证：分享成功规避风险的真实案例

## 禁忌事项
- ❌ 不要承诺"零风险"，法拍房本身有固有风险
- ❌ 不要贬低客户"不懂"，要引导教育
- ❌ 不要过度逼单，法拍房决策周期长，要有耐心
- ❌ 不要泄露其他客户的具体房源信息（隐私保护）`;

// 存储反馈数据
let feedbacks = [];

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

// 解析POST请求体
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// CORS头
function corsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
    corsHeaders(res);

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // API接口 - 聊天
    if (url.pathname === '/api/chat' && req.method === 'POST') {
        if (!API_KEY) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器未配置API Key' }));
            return;
        }

        try {
            const { message, history } = await parseBody(req);

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-ai/DeepSeek-V3',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        ...(history || []),
                        { role: 'user', content: message }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error(`API错误: ${response.status}`);
            }

            const data = await response.json();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                reply: data.choices[0].message.content 
            }));
        } catch (error) {
            console.error('Chat error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // API接口 - 反馈
    if (url.pathname === '/api/feedback' && req.method === 'POST') {
        try {
            const feedback = await parseBody(req);
            feedback.timestamp = new Date().toISOString();
            feedbacks.push(feedback);

            // 保存到文件
            try {
                fs.writeFileSync(path.join(__dirname, 'feedbacks.json'), JSON.stringify(feedbacks, null, 2));
            } catch(e) {}

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // 静态文件服务
    let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
    
    // 安全检查 - 防止路径遍历
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`法拍房销售助手已启动！`);
    console.log(`本地访问: http://localhost:${PORT}`);
    console.log(`请确保设置了 SILICONFLOW_API_KEY 环境变量`);
});
