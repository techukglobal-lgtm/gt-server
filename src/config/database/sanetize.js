// sanitization.js

function CleanDBData(data) {
    const dataType = typeof data;
    
    if (dataType === 'object' || Array.isArray(data)) {
        const jsonString = JSON.stringify(data);
        const sanitizedString = jsonString.replace(/[<>]/g, ''); 
        return JSON.parse(sanitizedString); 
    } else if (dataType === 'number') {
        return data;
    } else {
        
        const sanitizedData = String(data).replace(/[<>]/g, '');
        return sanitizedData;
    }
}

function CleanHTMLData(data) {
    const dataType = typeof data;
    
    if (dataType === 'number') {
        return data; 
    } else {
        const sanitizedData = String(data).replace(/[<>]/g, '');
        return sanitizedData;
    }
}


module.exports = {
    CleanDBData,
    CleanHTMLData
};
