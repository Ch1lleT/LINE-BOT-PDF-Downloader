import express from 'express'
import { configDotenv } from 'dotenv'
import { middleware } from '@line/bot-sdk'
import axios from 'axios'
import 'node:fs'
import { google } from 'googleapis'
import { Readable } from 'node:stream'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit';
import {readFileSync } from 'node:fs'
import { dirname } from 'node:path'


configDotenv()

const app = express()
const port = process.env.PORT

// Google API Authentication config
const auth = new google.auth.GoogleAuth({
    keyFile:`./${process.env.GOOGLE_SERVICE_ACCOUNT_FILE}`,
    scopes: ['https://www.googleapis.com/auth/drive'],
}) 



// Line middle configuration 
const Line_config = {
    channelSecret : process.env.CHANNEL_SECRET
}


app.post('/webhook',middleware(Line_config) , async (req,res )=>{
    
    // Event object from line platform 
    const _event = req.body.events[0]

    /* 
    Everything that happens in the chat, like sending messages, stickers, images, or files, is considered a message event. And in the message event, it's got a message type property to tell us what type of the message event is, like sending a file or regular message.

    Here i only focus on the PDF file.
    */
    if(_event.type == 'message' && _event.message.type == 'file' && _event.message.fileName.endsWith('.pdf'))
    {
        // Get content files (PDF file) from LINE platform. 
        const content = await axios.get('https://api-data.line.me/v2/bot/message/'+_event.message.id + '/content',
        {
            headers : {
                'Authorization' : 'Bearer ' + process.env.CHANNEL_ACCESS_TOKEN
            },
            responseType: 'arraybuffer',
            reponseEncoding: 'binary'
        })


        // PDF bytes data.
        const pdfBytes = content.data;

        // File's name. 
        const fileName = _event.message.fileName.replace(".pdf",'')

        // Load custom font.
        const fontBytes = readFileSync('./font/arialnarrow_bold.ttf')  
        
        // PDF bytes as PDFDocument Object.
        const pdf = await PDFDocument.load(pdfBytes);
        
        // Regist fontkit.
        pdf.registerFontkit(fontkit)
        
        // Embed font to PDF document.
        const font = await pdf.embedFont(fontBytes) 

        // Loop all pages.
        pdf.getPages().forEach((page)=>{

            // 
            page.drawText(fileName,{
                x: 16 ,
                y: 10,
                size:24,
                lineHeight:24,
                font:font,
                color :rgb(0,0,0)
            })

        })

        // get google drive service
        const drive = google.drive({
            version:"v3",
            auth:auth
        })
        
        // file metadata
        let fileMetaData = {
            name :`${fileName}.pdf`,
            parents : [process.env.GOOGLE_DRIVE_FOLDER_ID],
        }

        // actual pdf file
        let media = {
            mimeType : 'application/pdf',
            body: Readable.from(Buffer.from(await pdf.save()))
        }
        
        // upload to google drive
        const responese = await drive.files.create({
            resource:fileMetaData,
            media:media,
            fields:'id'
        })        
        
        // id of the file returned
        console.log(responese);    
    }
    return res.status(200).send() 
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))