package com.uhf18.scanlable;

import java.sql.Date;
import java.text.SimpleDateFormat;

import com.uhf18.scanlable.R;
import com.rfid.trans18.ReaderParameter;
import com.rfid.trans18.UHFLib;

import android.app.Activity;
import android.content.Intent;
import android.media.SoundPool;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

public class ScanView extends Activity implements OnClickListener{
	
	private TextView tvVersion;
	private TextView tvResult;
	private Spinner tvpowerdBm;

	private Button bSetting;
	private Button bRead;
	
	private Button paramRead;
	private Button paramSet;
	
	private Button modeSet;
	
	private int soundid;
	private int tty_speed = 57600;
	private byte addr = (byte) 0xff; 
	private String[] strBand =new String[5]; 
    private String[] strmaxFrm =null; 
    private String[] strminFrm =null; 
    
    byte[]Version=new byte[2];
	byte[]Power=new byte[1];
	byte[]aband=new byte[1];
	byte[]aMaxFre=new byte[1];
	byte[]aMinFre=new byte[1];
	byte[]scanTime=new byte[1];
	
    private int band,MaxFre,MinFre=0;
    Spinner spBand;
    Spinner spmaxFrm;
	Spinner spminFrm;
	
	Spinner sptidaddr;
	Spinner sptidlen;
	Spinner sptime;
	
	Spinner spMode;
	Spinner spType;
	Spinner spAddr;
	Spinner spLength;
	Spinner spBeep;
	Spinner spFiltime;
	
	Button Setparam;
	Button Getparam;
	private ArrayAdapter<String> spada_Band; 
    private ArrayAdapter<String> spada_maxFrm; 
    private ArrayAdapter<String> spada_minFrm; 
    
    private ArrayAdapter<String> spada_qvalue; 
    private ArrayAdapter<String> spada_session; 
    private ArrayAdapter<String> spada_tidaddr; 
    private ArrayAdapter<String> spada_tidlen; 
    
    private ArrayAdapter<String> spada_mode; 
    private ArrayAdapter<String> spada_type; 
    private ArrayAdapter<String> spada_actaddr; 
    private ArrayAdapter<String> spada_actlen; 
	private static final String TAG = "SacnView";
	private Handler mHandler;
	private static final int MSG_SHOW_RESULT = 1;
	private static final int MSG_SHOW_INFO = 2;
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		// TODO Auto-generated method stub  properties
		super.onCreate(savedInstanceState);	
		setContentView(R.layout.scan_view);
		initView();
		mHandler = new Handler(){
			@Override
			public void handleMessage(Message msg) {
				// TODO Auto-generated method stub
				super.handleMessage(msg);
				switch (msg.what) {
				case MSG_SHOW_RESULT:
					 String temp = (String) msg.obj;
					 Reader.writelog(temp,tvResult);
					 break;
				case MSG_SHOW_INFO:
					String hvn = String.valueOf(Version[0]);
					if(hvn.length()==1)hvn="0"+hvn;
					String lvn = String.valueOf(Version[1]);
					if(lvn.length()==1)lvn="0"+lvn;
					tvVersion.setText(hvn+"."+lvn);
					tvpowerdBm.setSelection(Power[0],true);
					SetFre(aband[0]);
					int bandindex = aband[0];
					if(bandindex ==8)
					{
						bandindex=bandindex-4;
					}
					else
					{
						bandindex=bandindex-1;
					}
					int time = scanTime[0]&255;
					if(time<1)time=1;
					sptime.setSelection(time-1,true);
					spBand.setSelection(bandindex,true);
					spminFrm.setSelection(aMinFre[0],true);
					spmaxFrm.setSelection(aMaxFre[0],true);
					break;
				default:
					break;
				}
			}
		};
	}
	
	private void initView(){
		
		
		tvVersion = (TextView)findViewById(R.id.version);
		tvResult = (TextView)findViewById(R.id.param_result);
		tvpowerdBm = (Spinner)findViewById(R.id.power_spinner);
		ArrayAdapter<CharSequence> adapter3 =  ArrayAdapter.createFromResource(this, R.array.Power_select, android.R.layout.simple_spinner_item);
		adapter3.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		tvpowerdBm.setAdapter(adapter3); 
		tvpowerdBm.setSelection(30, true);
		
	
		
		bSetting = (Button)findViewById(R.id.pro_setting);
		bRead = (Button)findViewById(R.id.pro_read);
		paramRead = (Button)findViewById(R.id.ivt_read);
		paramSet = (Button)findViewById(R.id.ivt_setting);
		modeSet = (Button)findViewById(R.id.mode_setting);
		bSetting.setOnClickListener(this);
		bRead.setOnClickListener(this);
		paramRead.setOnClickListener(this);
		paramSet.setOnClickListener(this);
		modeSet.setOnClickListener(this);
		////////////频锟斤拷选锟斤拷
		strBand[0]="Chinese band2";
		strBand[1]="US band";
		strBand[2]="Korean band";
		strBand[3]="EU band";
		strBand[4]="Chinese band1";
		
		spBand=(Spinner)findViewById(R.id.band_spinner);  
		spada_Band = new ArrayAdapter<String>(ScanView.this,  
	             android.R.layout.simple_spinner_item, strBand);  
		spada_Band.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
		spBand.setAdapter(spada_Band);  
		spBand.setSelection(1,false); 
		SetFre(2);////锟斤拷始锟斤拷频锟斤拷
		 // 锟斤拷锟絊pinner锟铰硷拷锟斤拷锟斤拷  
		spBand.setOnItemSelectedListener(new Spinner.OnItemSelectedListener() {  
        public void onItemSelected(AdapterView<?> arg0, View arg1,  
                int arg2, long arg3) {  
            // TODO Auto-generated method stub  
            // 锟斤拷锟斤拷锟斤拷示锟斤拷前选锟斤拷锟斤拷锟� 
            arg0.setVisibility(View.VISIBLE);  
            if(arg2==0)SetFre(1);
            if(arg2==1)SetFre(2);
            if(arg2==2)SetFre(3);
            if(arg2==3)SetFre(4);
            if(arg2==4)SetFre(8);
            //选锟斤拷默锟斤拷值锟斤拷锟斤拷执锟斤拷  
        }  
        public void onNothingSelected(AdapterView<?> arg0) {  
            // TODO Auto-generated method stub  
        	}  
		});  
		
	
		
		sptidaddr=(Spinner)findViewById(R.id.tidptr_spinner);  
		sptidlen=(Spinner)findViewById(R.id.tidlen_spinner);  
		ArrayAdapter<CharSequence> adapter2 =  ArrayAdapter.createFromResource(this, R.array.men_tid, android.R.layout.simple_spinner_item);
		adapter2.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		sptidaddr.setAdapter(adapter2); 
		sptidaddr.setSelection(0, true);
		sptidlen.setAdapter(adapter2); 
		sptidlen.setSelection(0, true);
		
		
		sptime = (Spinner)findViewById(R.id.time_spinner);   
		ArrayAdapter<CharSequence> adapter5 =  ArrayAdapter.createFromResource(this, R.array.men_time, android.R.layout.simple_spinner_item);
		adapter5.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		sptime.setAdapter(adapter5); 
		sptime.setSelection(9, true);
		
		spMode = (Spinner)findViewById(R.id.mode_spinner);   
		ArrayAdapter<CharSequence> adapter6 =  ArrayAdapter.createFromResource(this, R.array.mode_select, android.R.layout.simple_spinner_item);
		adapter6.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		spMode.setAdapter(adapter6); 
		spMode.setSelection(0, true);
		
		spType = (Spinner)findViewById(R.id.acmem_spinner);   
		ArrayAdapter<CharSequence> adapter7 =  ArrayAdapter.createFromResource(this, R.array.type_select, android.R.layout.simple_spinner_item);
		adapter7.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		spType.setAdapter(adapter7); 
		spType.setSelection(4, true);
		
		spAddr = (Spinner)findViewById(R.id.acstart_spinner);   
		ArrayAdapter<CharSequence> adapter8 =  ArrayAdapter.createFromResource(this, R.array.act_addr, android.R.layout.simple_spinner_item);
		adapter8.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		spAddr.setAdapter(adapter8); 
		spAddr.setSelection(2, true);
		
		spLength = (Spinner)findViewById(R.id.aclen_spinner);   
		ArrayAdapter<CharSequence> adapter9 =  ArrayAdapter.createFromResource(this, R.array.act_len, android.R.layout.simple_spinner_item);
		adapter9.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		spLength.setAdapter(adapter9); 
		spLength.setSelection(5, true);
		
		spBeep = (Spinner)findViewById(R.id.beep_spinner);   
		ArrayAdapter<CharSequence> adapter10 =  ArrayAdapter.createFromResource(this, R.array.beep_select, android.R.layout.simple_spinner_item);
		adapter10.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		spBeep.setAdapter(adapter10); 
		spBeep.setSelection(1, true);
		
		spFiltime = (Spinner)findViewById(R.id.filtime_spinner);   
		ArrayAdapter<CharSequence> adapter11 =  ArrayAdapter.createFromResource(this, R.array.men_filtime, android.R.layout.simple_spinner_item);
		adapter11.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
		spFiltime.setAdapter(adapter11); 
		spFiltime.setSelection(0, true);
		
	}
	
	
	
	@Override
	public void onClick(View view) {
		try{
			if(view == paramRead)
			{
				ReaderParameter param = Reader.rrlib.GetInventoryPatameter();
				sptidlen.setSelection(param.TidLen, true);
				sptidaddr.setSelection(param.TidPtr, true);
		
				Reader.writelog(getString(R.string.get_success),tvResult);
			}
			else if(view == paramSet)
			{
				ReaderParameter param = Reader.rrlib.GetInventoryPatameter();
				param.TidLen = sptidlen.getSelectedItemPosition();
				param.TidPtr = sptidaddr.getSelectedItemPosition();
			
				Reader.rrlib.SetInventoryPatameter(param);
				Reader.writelog(getString(R.string.set_success),tvResult);
			}
			else if (view == bSetting){
			    MaxFre=0;
				MinFre=0;
				final int Power= tvpowerdBm.getSelectedItemPosition();
				int fband = spBand.getSelectedItemPosition();
				final int scantime = sptime.getSelectedItemPosition()+1;
			    band=0;
				if(fband==0)band=1;
				if(fband==1)band=2;
				if(fband==2)band=3;
				if(fband==3)band=4;
				if(fband==4)band=8;
				int Frequent= spminFrm.getSelectedItemPosition();
				MinFre = Frequent;
				Frequent= spmaxFrm.getSelectedItemPosition();
				MaxFre = Frequent;
				
				Thread mThread = new Thread(new Runnable() 
				{  
		            @Override  
		            public void run() 
		            {  
		            	String temp="";
		            	int result = Reader.rrlib.SetInventoryScanTime(scantime);
					    result = Reader.rrlib.SetRfPower(Power);
						if(result!=0)
						{
							temp=getString(R.string.power_error);
						}
						
						result = Reader.rrlib.SetRegion(band,MaxFre,MinFre);
						if(result!=0)
						{
							if(temp=="")
							temp=getString(R.string.frequent_error);
							else
								temp+=(",\r\n"+getString(R.string.frequent_error));
						}
						
						if(temp!="")
						{
							mHandler.obtainMessage(MSG_SHOW_RESULT,temp).sendToTarget();
						}
						else
						{
							mHandler.obtainMessage(MSG_SHOW_RESULT,getString(R.string.set_success)).sendToTarget();
						}
		            }  
		        }); 
				mThread.start();
				
				
			}else if (view == bRead){
				
				Thread mThread = new Thread(new Runnable() 
				{  
		            @Override  
		            public void run() 
		            {  
		            	
						int result = Reader.rrlib.GetUHFInformation(Version, Power, aband, aMaxFre, aMinFre, scanTime);
						if(result==0)
						{
							mHandler.obtainMessage(MSG_SHOW_INFO,getString(R.string.get_success)).sendToTarget();
							mHandler.obtainMessage(MSG_SHOW_RESULT,getString(R.string.get_success)).sendToTarget();
						}
						else
						{
							mHandler.obtainMessage(MSG_SHOW_RESULT,getString(R.string.get_failed)).sendToTarget();
						}
		            }
		        }); 
				mThread.start();
				
				
			}
			else if (view == modeSet){
				final int mode= spMode.getSelectedItemPosition();
				final int readmem = spType.getSelectedItemPosition();
				final int startlen = spAddr.getSelectedItemPosition();
				final int readlen = spLength.getSelectedItemPosition()+1;
				final int filtimes = spFiltime.getSelectedItemPosition();
				final int beepen = spBeep.getSelectedItemPosition();
				Thread mThread = new Thread(new Runnable() 
				{  
		            @Override  
		            public void run() 
		            {  
		            	String temp="";
		            	byte[]Parameter = new byte[6];
		            	Parameter[0] = (byte)mode;
		            	int Mode_state=0;//18000-6c
		            	Mode_state |= 0x02;//RS232/485
		            	if(beepen==0)//关蜂鸣器
		            		Mode_state |= 0x04;
		            	Parameter[1] = (byte)Mode_state;
		            	Parameter[2] = (byte)readmem;
		            	Parameter[3] = (byte)readmem;
		            	Parameter[4] = (byte)readmem;
		            	Parameter[5] = (byte)readmem;
		            	int result = Reader.rrlib.SetWorkMode(Parameter);
						if(result!=0)
						{
							mHandler.obtainMessage(MSG_SHOW_RESULT,getString(R.string.set_failed)).sendToTarget();
						}
						else
						{
							mHandler.obtainMessage(MSG_SHOW_RESULT,getString(R.string.set_success)).sendToTarget();
						}
		            }  
		        }); 
				mThread.start();
				
				
			}
		}catch(Exception ex)
		{}
	}
	
	
	private void SetFre(int m)
	{
		if(m==1){ 
		    strmaxFrm=new String[20];
         	strminFrm=new String[20];
         	for(int i=0;i<20;i++){
         		String temp="";
         		float values=(float) (920.125 + i * 0.25);
         		temp=String.valueOf(values)+"MHz";
         		strminFrm[i]=temp;
         		strmaxFrm[i]=temp;
         	}
         	spmaxFrm=(Spinner)findViewById(R.id.max_spinner);  
         	spada_maxFrm = new ArrayAdapter<String>(ScanView.this,  
                      android.R.layout.simple_spinner_item, strmaxFrm);  
         	spada_maxFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
         	spmaxFrm.setAdapter(spada_maxFrm);  
         	spmaxFrm.setSelection(19,false);
         	
         	spminFrm=(Spinner)findViewById(R.id.min_spinner);  
         	spada_minFrm = new ArrayAdapter<String>(ScanView.this,  
                      android.R.layout.simple_spinner_item, strminFrm);  
         	spada_minFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
         	spminFrm.setAdapter(spada_minFrm);  
         	spminFrm.setSelection(0,false);
     }else if(m==2){
     	strmaxFrm=new String[50];
     	strminFrm=new String[50];
     	for(int i=0;i<50;i++){
     		String temp="";
     		float values=(float) (902.75 + i * 0.5);
     		temp=String.valueOf(values)+"MHz";
     		strminFrm[i]=temp;
     		strmaxFrm[i]=temp;
     	}
     	spmaxFrm=(Spinner)findViewById(R.id.max_spinner);  
     	spada_maxFrm = new ArrayAdapter<String>(ScanView.this,  
                  android.R.layout.simple_spinner_item, strmaxFrm);  
     	spada_maxFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
     	spmaxFrm.setAdapter(spada_maxFrm);  
     	spmaxFrm.setSelection(49,false);
     	
     	spminFrm=(Spinner)findViewById(R.id.min_spinner);  
     	spada_minFrm = new ArrayAdapter<String>(ScanView.this,  
                  android.R.layout.simple_spinner_item, strminFrm);  
     	spada_minFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
     	spminFrm.setAdapter(spada_minFrm);  
     	spminFrm.setSelection(0,false);
     }else if(m==3){
      	strmaxFrm=new String[32];
      	strminFrm=new String[32];
      	for(int i=0;i<32;i++){
      		String temp="";
      		float values=(float) (917.1 + i * 0.2);
      		temp=String.valueOf(values)+"MHz";
      		strminFrm[i]=temp;
      		strmaxFrm[i]=temp;
      	}
      	spmaxFrm=(Spinner)findViewById(R.id.max_spinner);  
      	spada_maxFrm = new ArrayAdapter<String>(ScanView.this,  
                   android.R.layout.simple_spinner_item, strmaxFrm);  
      	spada_maxFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
      	spmaxFrm.setAdapter(spada_maxFrm);  
      	spmaxFrm.setSelection(31,false);
      	
      	spminFrm=(Spinner)findViewById(R.id.min_spinner);  
      	spada_minFrm = new ArrayAdapter<String>(ScanView.this,  
                   android.R.layout.simple_spinner_item, strminFrm);  
      	spada_minFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
      	spminFrm.setAdapter(spada_minFrm);  
      	spminFrm.setSelection(0,false);
      }else if(m==4){
       	strmaxFrm=new String[15];
       	strminFrm=new String[15];
       	for(int i=0;i<15;i++){
       		String temp="";
       		float values=(float) (865.1 + i * 0.2);
       		temp=String.valueOf(values)+"MHz";
       		strminFrm[i]=temp;
       		strmaxFrm[i]=temp;
       	}
       	spmaxFrm=(Spinner)findViewById(R.id.max_spinner);  
       	spada_maxFrm = new ArrayAdapter<String>(ScanView.this,  
                    android.R.layout.simple_spinner_item, strmaxFrm);  
       	spada_maxFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
       	spmaxFrm.setAdapter(spada_maxFrm);  
       	spmaxFrm.setSelection(14,false);
       	
       	spminFrm=(Spinner)findViewById(R.id.min_spinner);  
       	spada_minFrm = new ArrayAdapter<String>(ScanView.this,  
                    android.R.layout.simple_spinner_item, strminFrm);  
       	spada_minFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
       	spminFrm.setAdapter(spada_minFrm);  
       	spminFrm.setSelection(0,false);
       }else if(m==8){
		    strmaxFrm=new String[20];
         	strminFrm=new String[20];
         	for(int i=0;i<20;i++){
         		String temp="";
         		float values=(float) (840.125 + i * 0.25);
         		temp=String.valueOf(values)+"MHz";
         		strminFrm[i]=temp;
         		strmaxFrm[i]=temp;
         	}
         	spmaxFrm=(Spinner)findViewById(R.id.max_spinner);  
         	spada_maxFrm = new ArrayAdapter<String>(ScanView.this,  
                      android.R.layout.simple_spinner_item, strmaxFrm);  
         	spada_maxFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
         	spmaxFrm.setAdapter(spada_maxFrm);  
         	spmaxFrm.setSelection(19,false);
         	
         	spminFrm=(Spinner)findViewById(R.id.min_spinner);  
         	spada_minFrm = new ArrayAdapter<String>(ScanView.this,  
                      android.R.layout.simple_spinner_item, strminFrm);  
         	spada_minFrm.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);  
         	spminFrm.setAdapter(spada_minFrm);  
         	spminFrm.setSelection(0,false);
       }
	}
}
