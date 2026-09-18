1.XP/Win7 32位系统 控件注册
将UHFReader18.dll，UHFReader18Proj.ocx拷贝到C:\WINDOWS\system32目录
regsvr32 UHFReader18Proj.ocx
2.WIN7 64 控件注册
将UHFReader18.dll，UHFReader18Proj.ocx拷贝到C:\Windows\SysWOW64目录
cd C:\Windows\SysWOW64
regsvr32 UHFReader18Proj.ocx
注：有的电脑需要把ocx文件拷贝到C:\Windows\SysWOW64，C:\WINDOWS\system32两个目录。
3.Inventory寻到卡的时候返回EPC长度LEN+EPC号的组合，无卡返回空值。

5.OpenTCP(),closeTCP()方法成功返回00,失败返回30