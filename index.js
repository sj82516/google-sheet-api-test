const axios = require('axios');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const qs = require('qs');

const app = express();
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: false,
    })
);

const {
    spreadsheet_id,
    sheet,
    port,
    domain,
    client_id,
    client_secret,
} = require('./config');

const scope =
    'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';

// -------------- OAuth 2.0 for Web Server Applications -------------------
app.get('/google/oauth', (req, res) => {
    // 為了取得 refresh_token，必須同時加入prompt=consent&access_type=offline
    // in order to get refresh_token, have to add "prompt=consent&access_type=offline"
    return res.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?
            scope=${encodeURI (scope)}&
            prompt=consent&
            include_granted_scopes=true&
            access_type=offline&
            state=state_parameter_passthrough_value&
            redirect_uri=${encodeURI (domain + 'google/oauth/callback')}&
            response_type=code&
            client_id=${client_id}
    `.replace(/\n|\t|\s/g, '')
    );
});

app.get('/google/oauth/callback', async (req, res) => {
    try {
        const code = req.query['code'];
        // 先用code 換 access token
        let data = qs.stringify({
            code,
            client_id,
            client_secret,
            redirect_uri: `${domain}google/oauth/callback`,
            grant_type: 'authorization_code',
            access_type: 'offline',
        });
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        };
        let response = await axios.post(
            'https://www.googleapis.com/oauth2/v4/token',
            data, {
                headers,
            }
        );

        // 可以把 response.data 中的 access_token / refresh_token保存在長期儲存中，如資料庫
        // Could store {access_token, refresh_token} of response.data into long term storage, such as Database
        res.json(response.data);

        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;

        await sheetAPITest({refreshToken});
    } catch (err) {
        console.error(err && err.response.data && err.response.data.error);
    }
});
// -------------- OAuth 2.0 for Web Server Applications -------------------

// -------------- OAuth 2.0 for Server-to-Server Applications -------------------
/* 先到Google APIs Console > 憑證 創建 服務帳號，並下載 .json 金鑰
 到 Google IAM 將剛剛的服務帳號加入「Service Management 管理者」權限
 將服務帳號加到 Google表單中的共用帳號 > 編輯者 */

/* Google to Google APIs Console > Certifications create service account and download .json key file.
Go to Google IAM and grant 「Service Management Manager」 to the account created last step.
Add the account to Google Sheet Sharing Setting > Editor
*/

const jwt = require('jsonwebtoken');
// 就是服務帳號的 .json金鑰
const googleServerKey = require("./test-f9099-a116e2dccb69.json")
// 產生 jwt token
const token = jwt.sign({
    "iss": googleServerKey.client_email,
    scope,
    "aud": "https://www.googleapis.com/oauth2/v4/token",
    "exp": Math.floor(Date.now() / 1000) + (60 * 60),
    "iat": Math.floor(Date.now() / 1000)
}, googleServerKey.private_key, {
    header: {
        "alg": "RS256",
        "typ": "JWT"
    }
})

// 拿jwt 換 access token
// take jwt to exchange access token
function getAccessTokenByJWT() {
    let data = qs.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    };
    return axios.post('https://www.googleapis.com/oauth2/v4/token', data, {
        headers
    });
}

app.get('/google/server-to-server', async (_, res) => {
    try{
        let response = await getAccessTokenByJWT()
        const accessToken = response.data.access_token;

        await sheetAPITest({accessToken});
        res.send("success");
    }catch(err){
        console.error(err);
    }
});


// -------------- OAuth 2.0 for Server-to-Server Applications -------------------


// sample response
// inside req.headers:
//  'x-goog-channel-id': 'arbitrary',
//   'x-goog-channel-expiration': 'Mon, 04 Jun 2018 04:25:24 GMT',
//   'x-goog-resource-state': 'update',
//   'x-goog-changed': 'content,properties',
//   'x-goog-message-number': '446627',
//   'x-goog-resource-id': 'vGbpBNXqB5VGBuzsPmskf2ILacc',
//   'x-goog-resource-uri': 'https://www.googleapis.com/drive/v2/files/1dMJEsOayj7RxMJ4-dX7LnrDOxqNzi1WeV3ref6q2okY?acknowledgeAbuse=false&supportsTeamDrives=false&updateViewedDate=false&alt=json',
// 如果是關注 drive file 改變， req.body不會有內容
// if you listen to drive file changes, the req.body shows nothings.
app.post('/drive/webhook', (req, res) => {
    console.log(req.body, req.headers);
});

app.get('/googlec3dc7ecbbadaec12.html', (_, res) => {
    return res.sendFile(path.join(__dirname, './googlec3dc7ecbbadaec12.html'));
});

app.listen(port || 3000, () => {
    console.log(`server listen on port ${port || 3000}`);
});

// -------------- Sheet API Test -------------------

// refresh google api token
function refreshToken(refresh_token) {
    let data = qs.stringify({
        refresh_token,
        client_id,
        client_secret,
        grant_type: 'refresh_token'
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    };
    return axios.post('https://www.googleapis.com/oauth2/v4/token', data, {
        headers
    });
}

// read
function readSheet() {
    return axios.get(
        encodeURI(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${sheet}!A:Z?majorDimension=ROWS`
        )
    );
}

// append Data
function appendSheet() {
    return axios.post(
        encodeURI(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${sheet}!A:Z:append?valueInputOption=RAW`
        ), {
            values: [
                ['test', "col1", 1234]
            ],
        }
    );
}

// watch sheet file
function watchSheetFile() {
    return axios.post(
        `https://www.googleapis.com/drive/v2/files/${spreadsheet_id}/watch`, {
            type: 'web_hook',
            id: 'channelIdAndShouldBeUnique' +
                Math.random().toString(36).substring(7),
            address: `${domain}/drive/webhook`,
        });
}

async function sheetAPITest({accessToken, refreshToken}) {
    try {
        let res = {};
        if(refreshToken){
            let res = await refreshToken(refreshToken);
            console.log(res.data);
            accessToken = res.data.access_token;
        }
        console.log('accessToken from refresh', accessToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        res = await readSheet();
        console.log('read from sheet', res.data);
        res = await appendSheet();
        console.log('append result', res.data);
        res = await watchSheetFile();
        console.log('watch sheet file result', res.data);
    } catch (err) {
        console.error(err && err.response.data && err.response.data.error);
    }
}