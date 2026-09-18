// 下列 ifdef 块是创建使从 DLL 导出更简单的
// 宏的标准方法。此 DLL 中的所有文件都是用命令行上定义的 UHFReader18_EXPORTS
// 符号编译的。在使用此 DLL 的
// 任何其他项目上不应定义此符号。这样，源文件中包含此文件的任何其他项目都会将
// UHFReader18_API 函数视为是从 DLL 导入的，而此 DLL 则将用此宏定义的
// 符号视为是被导出的。
#ifdef UHFReader18_EXPORTS
#define UHFReader18_API __declspec(dllexport)
#else
#define UHFReader18_API __declspec(dllimport)
#endif

// 此类是从 UHFReader18.dll 导出的
class UHFReader18_API CUHFReader18 {
public:
	CUHFReader18(void);
	// TODO: 在此添加您的方法。
};

extern UHFReader18_API int nUHFReader18;

UHFReader18_API int fnUHFReader18(void);
#ifdef __cplusplus
extern "C" {
#endif
	UHFReader18_API int fnRR_UHFRD(void);
	UHFReader18_API int CloseNetPort(int FrmHandle);
	UHFReader18_API int OpenNetPort(int Port,
		LPSTR IPaddr,
		unsigned char*ComAdr,
		int *Frmhandle);
	UHFReader18_API int OpenCom(int portNumber,unsigned char fbaud);
	UHFReader18_API int OpenComPort(int port,unsigned char *address,unsigned char baud,int* FrmHandle);
	UHFReader18_API int AutoOpenComPort(int *port,unsigned char *address,unsigned char baud,int *FrmHandle);
	UHFReader18_API int CloseComPort();
	UHFReader18_API int CloseSpecComPort(int FrmHandle);
	UHFReader18_API int WriteCard_G2 (unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char WordPtr,
		unsigned char Writedatalen,
		unsigned char *Writedata,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		int *WrittenDataNum,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int WriteBlock_G2 (unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char WordPtr,
		unsigned char Writedatalen,
		unsigned char *Writedata,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		int *WrittenDataNum,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int ReadCard_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char *Data,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int Inventory_G2(unsigned char *address,
		unsigned char AdrTID,
		unsigned char LenTID,
		unsigned char TIDFlag,
		unsigned char* pOUcharIDList,
		int *Totallen,		
		int *CardNum,
		int FrmHandle);
	UHFReader18_API int GetReaderInformation(unsigned char* ComAdr,				//读写器地址		
		unsigned char* VersionInfo,			//软件版本
		unsigned char* ReaderType,				//读写器型号
		unsigned char* TrType,		//支持的协议
		unsigned char* dmaxfre,           //当前读写器使用的最高频率
		unsigned char* dminfre,           //当前读写器使用的最低频率
		unsigned char* powerdBm,             //读写器的输出功率
		unsigned char* ScanTime,
		int FrmHandle);
	UHFReader18_API int SetEASAlarm_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char EAS,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int CheckEASAlarm_G2(unsigned char *address,int *Eerrorcode,int FrmHandle);
	UHFReader18_API int SetCardProtect_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char select,
		unsigned char setprotect,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int Writedfre(unsigned char * address,
		unsigned char *dmaxfre,
		unsigned char *dminfre,
		int FrmHandle);
	UHFReader18_API int WriteComAdr(unsigned char *address,
		unsigned char *ComAdrData,
		int FrmHandle);
	UHFReader18_API int WriteScanTime(unsigned char *address,
		unsigned char *ScanTime,
		int FrmHandle);
	UHFReader18_API int Writebaud(unsigned char *address,
		unsigned char *baud,
		int FrmHandle);
	UHFReader18_API int SetPowerDbm(unsigned char *address,
		unsigned char PowerDbm,
		int FrmHandle);

	UHFReader18_API int SetTriggerTime(unsigned char *ComAdr,
		unsigned char *TriggerTime,
		int FrmHandle);

	UHFReader18_API int BuzzerAndLEDControl(unsigned char *address,
		unsigned char AvtiveTime,
		unsigned char SilentTime,
		unsigned char Times,
		int FrmHandle);
	UHFReader18_API int SetAccuracy(unsigned char *ComAdr,
		unsigned char Accuracy,
		int FrmHandle);
	UHFReader18_API int SetOffsetTime(unsigned char *ComAdr,
		unsigned char OffsetTime,
		int FrmHandle);
	UHFReader18_API int SetWGParameter(unsigned char *address,
		unsigned char Wg_mode,
		unsigned char Wg_Data_Inteval,
		unsigned char Wg_Pulse_Width,
		unsigned char Wg_Pulse_Inteval,
		int FrmHandle);
	UHFReader18_API int SetWorkMode(unsigned char *address,
		unsigned char *Parameter,
		int FrmHandle);
	UHFReader18_API int GetWorkModeParameter(unsigned char *address,
		unsigned char *Parameter,
		int FrmHandle);
	UHFReader18_API int EraseCard_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int WriteEPC_G2(unsigned char *address,						       
		unsigned char *Password,
		unsigned char *WriteEPC,
		unsigned char WriteEPClen,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int DestroyCard_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int SetReadProtect_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int SetMultiReadProtect_G2(unsigned char *address,
		unsigned char *Password,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int RemoveReadProtect_G2(unsigned char *address,
		unsigned char *Password,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int CheckReadProtected_G2(unsigned char *address,
		unsigned char *readpro,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int LockUserBlock_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char WrdPointer,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int Inventory_6B(unsigned char *address,
		unsigned char* ID_6B,
		int FrmHandle);

	UHFReader18_API int inventory2_6B(unsigned char *address,
		unsigned char Condition,
		unsigned char StartAddress,
		unsigned char mask,
		unsigned char *ConditionContent,
		unsigned char* ID_6B,
		int *Cardnum,
		int FrmHandle);

	UHFReader18_API int ReadCard_6B(unsigned char *address,
		unsigned char* ID_6B,
		unsigned char StartAddress,
		unsigned char Num,
		unsigned char *Data,
		int *errorcode,
		int FrmHandle);

	UHFReader18_API int WriteCard_6B(unsigned char *address,
		unsigned char *ID_6B,
		unsigned char StartAddress,
		unsigned char *Writedata,
		unsigned char Writedatalen,
		unsigned char *writtenbyte,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int LockByte_6B(unsigned char *address,
		unsigned char *ID_6B,
		unsigned char StartAddress,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int CheckLock_6B(unsigned char *address,
		unsigned char *ID_6B,
		unsigned char StartAddress,
		unsigned char *ReLockState,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int ReadActiveModeData(unsigned char * ScanModeData,
		int *ValidDatalength,
		int FrmHandle);
	UHFReader18_API int SetFhssMode(unsigned char *ComAdr,
		unsigned char FhssMode,
		int FrmHandle);
	UHFReader18_API int GetFhssMode(unsigned char *ComAdr,
		unsigned char *FhssMode,
		int FrmHandle);

	UHFReader18_API int SetRelay(unsigned char *ComAdr,
		unsigned char RelayStatus,
		int FrmHandle);

	UHFReader18_API int SetRelayTime(unsigned char *ComAdr,
		unsigned char* RelayTime,
		int FrmHandle);

	UHFReader18_API int SetAntenna(unsigned char *ComAdr,
		unsigned char Ant_Mode,
		unsigned char Ant_SWTcnt,
		unsigned char AntInfoEn,
		int FrmHandle);

	UHFReader18_API int SetQvalue(unsigned char *ComAdr,
		unsigned char Qvalue,
		int FrmHandle);

	UHFReader18_API int GetAntenna(unsigned char *ComAdr,
		unsigned char *Ant_No,
		int FrmHandle);

	UHFReader18_API int GetQandAntenna(unsigned char *ComAdr,
		unsigned char *Qvalue,
		unsigned char* Ant_Mode,
		unsigned char* Ant_SWTcnt,
		unsigned char* AntInfoEn,
		int FrmHandle);

	UHFReader18_API int SetPSW(unsigned char *ComAdr,
		unsigned char* PSW,
		int FrmHandle);

	UHFReader18_API int GetPSW(unsigned char *ComAdr,
		unsigned char* PSW,
		int FrmHandle);

	UHFReader18_API int SetUserEPC(unsigned char *ComAdr,
		unsigned char* UserEPC,
		int FrmHandle);

	UHFReader18_API int GetUserEPC(unsigned char *ComAdr,
		unsigned char* UserEPC,
		int FrmHandle);
	UHFReader18_API int ReadData_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char MaskMem,
		unsigned char *MaskAdr,
		unsigned char MaskLen,
		unsigned char *MaskData,
		unsigned char *Data,
		int *Errorcode,
		int FrmHandle);
	UHFReader18_API int WriteData_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char WNum,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char WordPtr,
		unsigned char *Wdt,
		unsigned char *Password,
		unsigned char MaskMem,
		unsigned char *MaskAdr,
		unsigned char MaskLen,
		unsigned char *MaskData,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int Lock_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char ENum,
		unsigned char select,
		unsigned char setprotect,
		unsigned char *Password,
		unsigned char MaskMem,
		unsigned char *MaskAdr,
		unsigned char MaskLen,
		unsigned char *MaskData,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int WriteEPCByMask(unsigned char *address,
		unsigned char *EPC,
		unsigned char WNum,
		unsigned char ENum,
		unsigned char *Password,
		unsigned char *WData,
		unsigned char MaskMem,
		unsigned char *MaskAdr,
		unsigned char MaskLen,
		unsigned char *MaskData,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int ExtReadCard_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char *Data,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int ExtWriteCard_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char Writedatalen,
		unsigned char *Writedata,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		int *WrittenDataNum,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int ExtEraseCard_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char maskadr,
		unsigned char maskLen,
		unsigned char maskFlag,
		unsigned char EPClength,
		int *Errorcode,
		int FrmHandle);


	UHFReader18_API int ExtReadData_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char MaskMem,
		unsigned char *MaskAdr,
		unsigned char MaskLen,
		unsigned char *MaskData,
		unsigned char *Data,
		int *Errorcode,
		int FrmHandle)	;


	UHFReader18_API int ExtWriteData_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char WNum,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char *Wdt,
		unsigned char *Password,
		unsigned char MaskMem,
		unsigned char *MaskAdr,
		unsigned char MaskLen,
		unsigned char *MaskData,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int GetSeriaNo(unsigned char *ComAdr,
		unsigned char* SeriaNo,
		int FrmHandle);

	UHFReader18_API int GetInputPin(unsigned char *ComAdr,
		unsigned char* InputPin,
		int FrmHandle);

	UHFReader18_API int ReadEEPROM(unsigned char *ComAdr,
		unsigned char Pointer,
		unsigned char Num,
		unsigned char *Data,
		int FrmHandle);

	UHFReader18_API int WriteEEPROM(unsigned char *ComAdr,
		unsigned char Pointer,
		unsigned char Num,
		unsigned char *Data,
		int FrmHandle);

	UHFReader18_API int SetSyris_Data_Inteval(unsigned char *address,
		unsigned char *Syris_Data_Inteval,
		int FrmHandle);

	UHFReader18_API int AdvInventory_G2(unsigned char *address,
		unsigned char AntMode,
		unsigned char* pOUcharIDList,
		int *Totallen,		
		int *CardNum,
		int FrmHandle)	;

	UHFReader18_API int ExtAdvReadData_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char AntSelect,
		unsigned char *Data,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int ExtAdvWriteData_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char WNum,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char *Wdt,
		unsigned char *Password,
		unsigned char AntSelect,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int ExtAdvWriteBlock_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char WNum,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char *Wdt,
		unsigned char *Password,
		unsigned char AntSelect,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int ExtAdvEraseBlock_G2(unsigned char *address,
		unsigned char *EPC,
		unsigned char ENum,
		unsigned char Mem,
		unsigned char *WordPtr,
		unsigned char Num,
		unsigned char *Password,
		unsigned char AntSelect,
		unsigned char *Data,
		int *Errorcode,
		int FrmHandle);

	UHFReader18_API int SetUserPSW(unsigned char *ComAdr,
		unsigned char* PSW,
		int FrmHandle);

	UHFReader18_API int GetUserPSW(unsigned char *ComAdr,
		unsigned char* PSW,
		int FrmHandle);

	UHFReader18_API int ChangeMode(unsigned char *ComAdr,
		unsigned char *Mode,
		int FrmHandle);

	UHFReader18_API int SetUserID(unsigned char *ComAdr,
		unsigned char* UserID,
		int FrmHandle);

	UHFReader18_API int GetUserID(unsigned char *ComAdr,
		unsigned char* UserID,
		int FrmHandle);

	UHFReader18_API int SetReadPauseTime(unsigned char *ComAdr,
		unsigned char* ReadPauseTime,
		int FrmHandle);

	UHFReader18_API int SetUserMask(unsigned char *ComAdr,
		unsigned char FilterEn,
		unsigned char* UserMask,
		int FrmHandle);

	UHFReader18_API int GetUserMask(unsigned char *ComAdr,
		unsigned char *FilterEn,
		unsigned char* UserMask,
		int FrmHandle);
	UHFReader18_API int SetAutoTIDEn(unsigned char *ComAdr,
		unsigned char AutoTIDEn,
		int FrmHandle);
	UHFReader18_API int GetAutoTIDEn(unsigned char *ComAdr,
		unsigned char *AutoTIDEn,
		int FrmHandle);
	UHFReader18_API int SetRedLED(unsigned char *ComAdr,
		unsigned char LEDStatus,
		int FrmHandle);
	UHFReader18_API int SetGreenLED(unsigned char *ComAdr,
		unsigned char LEDStatus,
		int FrmHandle);
	UHFReader18_API int GetLEDStatus(unsigned char *ComAdr,
		unsigned char *LEDStatus,
		int FrmHandle);
	UHFReader18_API int SetAnt(unsigned char *ComAdr,
		unsigned char Ant,
		int FrmHandle);
	UHFReader18_API int GetAnt(unsigned char *ComAdr,
		unsigned char *Ant,
		int FrmHandle);
	UHFReader18_API int SetParameter(unsigned char *ComAdr,
		unsigned char *Parameter,
		int FrmHandle);
	UHFReader18_API int GetParameter(unsigned char *ComAdr,
		unsigned char *Parameter,
		int FrmHandle);

	UHFReader18_API int SetMacAddr(unsigned char *ComAdr,
		unsigned char *MacAddr,
		int FrmHandle);
	UHFReader18_API int GetMacAddr(unsigned char *ComAdr,
		unsigned char *MacAddr,
		int FrmHandle);
	UHFReader18_API int Inventory_TID(unsigned char *address,
		unsigned char AdrTID,
		unsigned char LenTID,
		int *EPCSize,
		unsigned char* pEPCList,
		int *TIDSize,
		unsigned char* pTIDList,	
		int *CardNum,
		int FrmHandle);
	UHFReader18_API int SwitchTime(unsigned char *ComAdr,
		unsigned char* nTime,
		int FrmHandle);

#ifdef __cplusplus
}
#endif