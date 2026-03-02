import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { SentimentChart } from './SentimentChart';
import { ComplaintChart } from './ComplaintChart';
import { RecentIssuesList } from './RecentIssuesList';
import { TopComplainersTable } from './TopComplainersTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, MessageSquare, AlertTriangle, ThumbsUp } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface AIInsightsTabProps {
  data: UnifiedAnalyticsData;
}

export function AIInsightsTab({ data }: AIInsightsTabProps) {
  const totalMessages = data.sentimentDistribution.positive + 
                        data.sentimentDistribution.neutral + 
                        data.sentimentDistribution.negative;
  
  const complaintCount = data.complaintCategories.reduce((sum, cat) => sum + cat.count, 0);
  
  // Calculate sentiment score
  const sentimentScore = totalMessages > 0 
    ? Math.round(
        (data.sentimentDistribution.positive * 100 + 
         data.sentimentDistribution.neutral * 50 + 
         data.sentimentDistribution.negative * 0) / totalMessages
      )
    : 50;

  return (
    <div className="space-y-6">
      {/* AI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ข้อความที่วิเคราะห์</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{formatNumber(totalMessages)}</div>
            <div className="text-sm text-gray-500 mt-1">30 วันล่าสุด</div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">คะแนนความพึงพอใจ</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{sentimentScore}/100</div>
            <div className="text-sm mt-1">
              <Badge 
                variant="outline" 
                className={sentimentScore >= 70 ? 'bg-green-100 text-green-800' : 
                           sentimentScore >= 50 ? 'bg-yellow-100 text-yellow-800' : 
                           'bg-red-100 text-red-800'}
              >
                {sentimentScore >= 70 ? 'ดีมาก' : sentimentScore >= 50 ? 'ปานกลาง' : 'ต้องปรับปรุง'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">จำนวนร้องเรียน</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{formatNumber(complaintCount)}</div>
            <div className="text-sm text-gray-500 mt-1">
              {totalMessages > 0 ? Math.round((complaintCount / totalMessages) * 100) : 0}% ของข้อความทั้งหมด
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">สถานะ AI</CardTitle>
            <BrainCircuit className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-700">ทำงานอยู่</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              วิเคราะห์อัตโนมัติทุกชั่วโมง
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment and Complaint Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentChart distribution={data.sentimentDistribution} />
        <ComplaintChart categories={data.complaintCategories} />
      </div>

      {/* Issues and Complainers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentIssuesList issues={data.recentIssues} />
        <TopComplainersTable complainers={data.topComplainers} />
      </div>

      {/* AI Analysis Info */}
      <Card className="border-blue-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-white shadow-sm">
              <BrainCircuit className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1E3A8A] mb-1">เกี่ยวกับ AI Sentiment Analysis</h3>
              <p className="text-sm text-gray-600 mb-2">
                ระบบใช้ Google Gemini AI วิเคราะห์ความรู้สึกจากข้อความลูกค้าแบบ real-time 
                ตรวจจับปัญหาและร้องเรียนอัตโนมัติ พร้อมจัดลำดับความเร่งด่วน
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-white">การจัดส่ง</Badge>
                <Badge variant="outline" className="bg-white">สินค้า</Badge>
                <Badge variant="outline" className="bg-white">ราคา</Badge>
                <Badge variant="outline" className="bg-white">บริการ</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
