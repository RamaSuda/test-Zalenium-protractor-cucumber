import { browser } from './';

import { ensureDirSync } from 'fs-extra';

import { logger } from '../utils/logger';

import * as path from 'path';



const fs = require('fs');
const base64Img = require('base64-img');

export async function screenshot(fileName: string, zoom: string = '50') {
    fileName = fileName.replace(/ /g,"-").replace(/\//g,"-");
    let filelocation: string = "";

    await browser.waitForAngular();
    await browser.executeScript("document.body.style.zoom='"+zoom+"%'");
    await browser.takeScreenshot().then(async function (png) {
        await browser.executeScript("document.body.style.zoom='100%'");

        try {
            ensureDirSync(path.resolve(browser.params.folderName));
        } catch (e) {
            //if(e.clode !== 'EEXIST') throw e;
        }
        let date: Date = new Date();
        let dateString: string = date.toDateString()+"-at-"+date.getHours()+":"+date.getMinutes()
            +":"+date.getSeconds()+"."+date.getMilliseconds();

        filelocation = browser.params.folderName + fileName +"."+dateString.replace(/ /g,"-")+".png";
        filelocation = filelocation.replace('#', "");
        logger.debug("screenshot: " + filelocation);
        return await new Promise ( (resolve, reject) =>{
            const stream = fs.createWriteStream(filelocation);
            stream.write(new Buffer(png, 'base64'));
            stream.end();
            stream.on('finish' , () => { resolve(true); });
            stream.on("error", reject);
        });
    });
}



