1.XP/Win7 32位系统 控件注册
将UHFReader09.dll，UHFReader09Proj.ocx拷贝到C:\WINDOWS\system32目录
运行
regsvr32 UHFReader09Proj.ocx
2.WIN7 64 控件注册
将UHFReader09.dll，UHFReader09Proj.ocx拷贝到C:\Windows\SysWOW64目录
运行 cmd进入dos界面按以下2步骤操作：
cd C:\Windows\SysWOW64
regsvr32 UHFReader09Proj.ocx