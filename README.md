<!-- Services -->
  <div class="" id="setup">
    <div class="intro-content d-block">
    <h1 class="w3-xxxlarge w3-text-primary"><b>MINJEMR Setup & Installation</b></h1>
    <hr style="width: 70px; height: 2px; background-color: #1eb685;opacity: 1;margin: 0 0 20px 0;" class="w3-round">    
      <ul>
        <li>This details for developers who wants to clone DanpheEMR, Use it and help us for improvements.</li>
        <li>We have all details like software and tools requirements</li>
        <li>Step by step guide for build and run project</li>
        <li>Database creation and more..</li>
      </ul>
      <div>
        <h4>Prerequisites</h4>
        <ul>
          <li>Visual Studio 2017/2019</li>
          <li>VS code</li>
          <li>MS SQL Server 2017 (14.0.202) or later</li>
        </ul>
      </div>
       <div>
        <h4>Important note</h4>
        <ul>
          <li>Make sure you run source code from a proper drive like "C:\Danphe" drive or "D:\Danphe" drive and not in Desktop or downloads folder. This is needed because the code needs elevated rights.</li>
          <li>In Appsettings.json change the below values to your directory paths  <br>
        "ServiceAccountKey": "D:\\DanpheGitLab\\FileUploadTest\\credentials.json",<br>
        "LoggerFilePath": "D:\\DanpheGitLab\\FileUploadTest\\FileUploadTestLogger",<br>
          "UploadFileBasePath": "D:\\DanpheGitLab\\FileUploadTest\\LabReports"</li>
        </ul>
      </div>
      <div>
        <h4>Build Angular Project</h4>
        <ul class="code-list">
          <li>Go to <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">Code\Websites\DanpheEMR\wwwroot\DanpheApp</code> path and open DanpheApp folder in VS code</li>
          <li>Open a new terminal and execute below command </li>
          <div>
            <pre class="lang-sh prettyprint">
              <code class="animated fadeIn">
                <span class="pln">npm install</span>
              </code>
            </pre>   
          </div> 
          <li>Then execute below command</li>
          <div>
            <pre class="lang-sh prettyprint">
              <code class="animated fadeIn">
                <span class="pln">ng build --watch</span>
              </code>
            </pre>   
          </div> 
        </ul>
      </div>
      <div>
        <h4>Database Creation</h4>
        <ul class="code-list">
          <li>Go to Database folder and execute <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">1. DanpheAdmin_CompleteDB.sql</code> file in sql server(This will create admin database)</li>
          <li>Go to Database folder extract rar file <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">2.DanpheEMR_OS.rar</code></li>
          <li>Then restore database by using bak file in database folder and this is main database with name <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">DanpheEMR_OS</code></li>
          <li>After successful restore go to Database folder and execute increamental file <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">3.Increamental_DBScript.sql</code> on <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">DanpheEMR_OS</code> database</li>
        </ul>
      </div>
      <div>
        <h4>Build Project</h4>
        <ul class="code-list code-list-block">
          <li>Go to <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">Code\Solutions</code> and open solution <code class="inline-code__InlineCode-sc-6w7ni7-0 cfZKRM">DanpheEMR.sln</code> in visual studio</li>
          <div class="alert alert-success my-3">
            <strong>Note:</strong> If MINJEMR project not loaded in visual studio then please install .net core sdk version 3.1.301
            or change sdk version number as per your machine sdk in global.json file
            path=> Solution Items\global.json file
          </div>
          
      
          <li><strong>Update appsetting.json file for database name and credentials </strong>
            <p class="details">Go to DanpheEMR project (in visual studio) and open appsettings.json file</p>
            <p class="details">Here we have 3 connection strings. Update every connection string with your machine database name (initial catalog) and data source name.</p>
          </li>
         
         
          <li><strong>Build DanpheEMR (project server side)</strong>
            <p class="details">Go to visual studio and right click on solution name</p>
            <p class="details">click on Rebuild solution</p>
          </li>      
          
      
          <li><strong>Run project</strong> </li>
          <!-- <p class="Details">(without debuging) Go to visual studio click on Debug menu => click on "Start without debuging" / ctrl+f5</p><br>
          <p class="Details">(with debuging) Go to visual studio click on Debug Menu => click on "Start Debuging"</p>      -->
        </ul>
      </div>
    </div>
  </div>  
  
  <h1 class="w3-xxxlarge w3-text-primary"><b>MINJPACS Setup & Installation</b></h1>
  <hr style="width: 70px; height: 2px; background-color: #1eb685;opacity: 1;margin: 0 0 20px 0;" class="w3-round">  
   
   <h1 class="w3-xxxlarge w3-text-primary"><b>MINJDICOM Setup & Installation</b></h1>
   <hr style="width: 70px; height: 2px; background-color: #1eb685;opacity: 1;margin: 0 0 20px 0;" class="w3-round"> 
