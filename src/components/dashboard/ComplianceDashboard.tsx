// 파일명: ComplianceDashboard.tsx
import React from 'react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { DashboardEnterprise } from './DashboardEnterprise'; // 여기서 import
import { DashboardLEA } from './DashboardLEA';

export const ComplianceDashboard = () => {
  const { userType } = useGlobalStore();
  if (userType === 'lea') return <DashboardLEA />;
  return <DashboardEnterprise />;
};